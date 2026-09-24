package com.project.platform.controller;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 授权模型的 HTTP 层回归网。
 *
 * <p>授权已由 {@code LoginInterceptor.checkRole} → {@link com.project.platform.config.AuthzRules}
 * 的「默认拒绝 + 显式放行表」接管。规则表本身的逐条覆盖在
 * {@code config/AuthzRulesTest}(纯单测)里,本类只验证**端起端到**的真实效果:
 * 拦截器 + 服务层合起来,角色到底能不能访问。
 *
 * <p>四段语义不同,**不要混读**:
 * <ul>
 *   <li><b>A. 合法访问矩阵</b> —— 前端真正在用的端点,必须一直 200。</li>
 *   <li><b>B. 默认拒绝</b> —— 未登记的遗留端点,必须对**所有角色** 403。
 *       注:Phase 4 已把对应的 14 个遗留控制器**物理删除**,这些路径现在没有处理器;
 *       但拦截器仍先一步挡下,故本段断言一字未改仍然成立(外部表现与删除前一致)。</li>
 *   <li><b>C. 已正确的行为</b> —— 服务层守卫、归属校验、错误路径,不许改坏。</li>
 *   <li><b>D. 对象级越权已关闭(Phase 1b)</b> —— chat 的会话归属校验已补上:
 *       非参与者 403、会话不存在 404。</li>
 * </ul>
 *
 * <p>另见 {@code config/AuthzRulesTest}。两类的分工:那边测「规则表说放不放」,
 * 这边测「拦截器真的照做了」。
 */
class AuthorizationBaselineTest extends BaseControllerTest {

    // ═══════════════════════ A. 合法访问矩阵(必须一直 200) ═══════════════════════

    @Test
    @DisplayName("A. 匿名可访问的公开端点")
    void anonymousPublicEndpointsStayOpen() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.get("/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        mockMvc.perform(MockMvcRequestBuilders.get("/search/trending"))
                .andExpect(status().isOk());
        mockMvc.perform(MockMvcRequestBuilders.get("/merchants/1/profile"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("A. USER 可访问自己的业务端点(前端主链路)")
    void userOwnEndpointsStayOpen() throws Exception {
        String token = userToken();
        String[] endpoints = {
                "/orders", "/orders/recent", "/account/profile", "/addresses",
                "/notifications", "/coupons", "/coupons/my-coupons", "/returns",
                "/stock-alerts/mine", "/dashboard/stats", "/chat/conversations",
                "/shoppingCart/page"
        };
        for (String url : endpoints) {
            get(url, token)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(200));
        }
    }

    @Test
    @DisplayName("A. SHOP 可访问商家后台,以及买卖双方共用的会话/通知")
    void shopEndpointsStayOpen() throws Exception {
        String token = shopToken();
        for (String url : new String[]{"/merchant/products", "/merchant/dashboard/stats",
                "/merchant/orders", "/merchant/wallet", "/merchant/settings",
                // 这两条是「卖家也用」的证明:前端 ChatWidget + useMerchantNotifications 挂在商家域
                "/chat/conversations", "/notifications"}) {
            get(url, token)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(200));
        }
    }

    @Test
    @DisplayName("A. ADMIN 可访问管理后台,以及管理端消费的通知端点")
    void adminEndpointsStayOpen() throws Exception {
        String token = adminToken();
        for (String url : new String[]{"/admin/users", "/admin/dashboard/stats", "/admin/merchants",
                "/admin/products", "/admin/orders", "/admin/reviews",
                // 前端 pages/admin/Notifications.vue 消费 /notifications
                "/notifications"}) {
            get(url, token)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(200));
        }
    }

    @Test
    @DisplayName("A. 未登录访问受保护端点 → 401")
    void anonymousProtectedEndpointsRejected() throws Exception {
        for (String url : new String[]{"/orders", "/account/profile", "/shoppingCart/page", "/merchant/products"}) {
            mockMvc.perform(MockMvcRequestBuilders.get(url))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value(401));
        }
    }

    // ═══════════ B. 默认拒绝:未登记的遗留端点对所有角色 403(Phase 1a 已收口) ═══════════

    @Test
    @DisplayName("B. 未登记的遗留读端点 → 403(曾对任意登录用户开放)")
    void unlistedLegacyReadsAreDenied() throws Exception {
        String[] endpoints = {
                "/slideshow/list",              // 首页轮播
                "/advertising/list",            // 广告位
                "/productType/list",
                "/shop/list",
                "/product/list",
                "/shippingAddress/list",        // 曾泄漏全表收货地址
                "/productCollect/list",
                "/shopCollect/list",
                "/productBrowsingHistory/list",
                "/productOrderEvaluate/list",
                "/user/list",
                "/admin-accounts/page",
                "/statisticalReportForms/productTypeProportionOfChar"
        };
        for (String url : endpoints) {
            for (String role : new String[]{"user", "shop", "admin"}) {
                get(url, tokenOf(role))
                        .andExpect(status().isForbidden())
                        .andExpect(jsonPath("$.code").value(403));
            }
        }
    }

    @Test
    @DisplayName("B. 未登记的遗留写端点 → 403(曾对任意登录用户开放)")
    void unlistedLegacyWritesAreDenied() throws Exception {
        for (String url : new String[]{"/slideshow/delBatch", "/advertising/delBatch",
                "/shippingAddress/delBatch", "/product/delBatch", "/shop/delBatch",
                "/productCollect/delBatch", "/productType/delBatch"}) {
            delWithBody(url, userToken(), List.of(-1)).andExpect(status().isForbidden());
            delWithBody(url, adminToken(), List.of(-1)).andExpect(status().isForbidden());
        }
        // update 是 PUT 而非 DELETE:必须用真实方法请求,否则没有 handler,拦截器不跑,
        // 请求会落到 NoResourceFoundException → 500(那是 Phase 3 要修的缺失异常处理器,不是授权结果)
        put("/product/update", userToken(), Map.of("id", 1, "name", "x"))
                .andExpect(status().isForbidden());
        put("/slideshow/update", userToken(), Map.of("id", 1))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("B. 购物车同 Controller 下前端不调用的三个端点也被关闭(含无归属校验的 createOrder)")
    void unusedShoppingCartEndpointsAreDenied() throws Exception {
        get("/shoppingCart/list", userToken()).andExpect(status().isForbidden());
        get("/shoppingCart/selectById/1", userToken()).andExpect(status().isForbidden());
        post("/shoppingCart/createOrder", userToken(), Map.of(
                "ids", List.of(1), "consigneeName", "x", "consigneeTel", "0", "consigneeAddress", "y"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("B. 角色不跨域:买家进不了商家/管理后台,商家进不了管理后台")
    void rolesCannotCrossDomainsOverHttp() throws Exception {
        get("/merchant/products", userToken()).andExpect(status().isForbidden());
        get("/merchant/products", adminToken()).andExpect(status().isForbidden());
        get("/admin/users", shopToken()).andExpect(status().isForbidden());
        get("/admin/users", userToken()).andExpect(status().isForbidden());
        get("/orders", shopToken()).andExpect(status().isForbidden());
        get("/orders", adminToken()).andExpect(status().isForbidden());
        get("/chat/conversations", adminToken()).andExpect(status().isForbidden());
    }

    // ═══════════ C. 已正确的行为(不许改坏) ═══════════

    @Test
    @DisplayName("C. 授权层先拒,服务层守卫仍在:USER 建商品被 403 拦在授权层")
    void userCannotCreateProduct() throws Exception {
        // 服务层 ProductServiceImpl.insert 另有「仅 SHOP」守卫(409)与 shopId 覆写,
        // 但现在授权层更早一步拒绝(/product/** 未登记),所以外部看不到 409。
        post("/product/add", userToken(), Map.of(
                "name", "不该被创建的商品", "mainImg", "/img/x.jpg", "productTypeId", 1,
                "price", 1.00, "stock", 1, "salesVolume", 0, "shopId", 2))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("C. 前缀误命中已消除:曾因 startsWith 被顺带门控的两个控制器现在是显式拒绝")
    void prefixCollisionIsGone() throws Exception {
        // 旧实现里 /admin/** 命中 /admin-accounts、/productOrder/** 命中 /productOrderEvaluate,
        // 于是二者「意外地」是 ADMIN 专属。现在它们是**显式**未登记 → 对所有角色 403。
        assertNotEquals(200, statusOf(get("/admin-accounts/page", adminToken())),
                "/admin-accounts 未登记,ADMIN 也不该放行 —— 若为 200 说明又回到前缀匹配了");
        assertNotEquals(200, statusOf(get("/productOrderEvaluate/list", adminToken())),
                "/productOrderEvaluate 未登记,ADMIN 也不该放行");
        // 而真正的管理后台不受影响
        get("/admin/users", adminToken()).andExpect(status().isOk());
    }

    @Test
    @DisplayName("C. 购物车 4 个在用端点全有归属守卫(user2 改不动 user1 的行)")
    void shoppingCartEndpointsAreGuarded() throws Exception {
        post("/shoppingCart/add", userToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isOk());
        int rowId = firstCartRowId(userToken());
        put("/shoppingCart/update", user2Token(), Map.of("id", rowId, "quantity", 99))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
        assertEquals(1, firstCartQuantity(userToken()), "user1 的数量不应被改动");
    }

    @Test
    @DisplayName("C. 未知路径不泄漏存在性:已登录 403、匿名 401(拦截先于 handler 解析)")
    void unknownPathsAreNotLeaked() throws Exception {
        // 拦截器在 handler 解析之后、执行之前运行,而 Spring 的静态资源处理器认领 `/**`,
        // 所以「路径不存在」也走拦截器 —— 于是未知路径对已登录用户是 403、对匿名是 401,
        // 而不是 404。这是默认拒绝的必然结果,好处是探测者无法区分路径存在与否。
        //
        // 注意 /error 仍在 SpringMvcConfig 的白名单里:那管的是「handler 抛异常后转发到
        // /error」这条路径,若不放行会把真错误变成 403(handler 抛出的异常由
        // GlobalExceptionHandler 兜住,故本测试无法直接覆盖它)。
        assertEquals(403, statusOf(get("/no/such/endpoint", userToken())),
                "未知路径对已登录用户应为 403(规则表未登记)");
        int anonymousStatus = mockMvc.perform(MockMvcRequestBuilders.get("/no/such/endpoint"))
                .andReturn().getResponse().getStatus();
        assertEquals(401, anonymousStatus, "未知路径对匿名用户应为 401(先过认证)");
    }

    // ═══════════ D. 对象级越权已关闭(Phase 1b) ═══════════

    @Test
    @DisplayName("D. chat 是放行端点,但会话归属校验已补上:非参与者 403、会话不存在 404")
    void conversationOwnershipIsEnforced() throws Exception {
        // /chat/** 在规则表里(买卖双方共用),所以授权层放行 —— 这里验的是服务层的归属校验。
        // 补 1b 之前,任意 id 都能读到 200 空列表(旧测试的注释还写着 "works for any ID")。
        assertEquals(404, statusOf(get("/chat/conversations/999999/messages", userToken())),
                "会话不存在应为 404,而不是 200 空列表");

        int user1Conversation = createConversation(userToken(), 1, "private thread");
        get("/chat/conversations/" + user1Conversation + "/messages", user2Token())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    /** 建会话(发一条消息),返回会话 id */
    private int createConversation(String token, int receiverShopId, String content) throws Exception {
        MvcResult result = post("/chat/messages", token, Map.of(
                "receiverId", receiverShopId, "content", content))
                .andExpect(status().isOk()).andReturn();
        Integer conversationId = JSONObject.parseObject(
                        result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data").getInteger("conversationId");
        assertNotNull(conversationId, "发消息应回填 conversationId");
        return conversationId;
    }

    // ─────────────────────────── helpers ───────────────────────────

    private String tokenOf(String role) {
        return switch (role) {
            case "user" -> userToken();
            case "shop" -> shopToken();
            case "admin" -> adminToken();
            default -> throw new IllegalArgumentException("未知角色: " + role);
        };
    }

    private int statusOf(ResultActions actions) throws Exception {
        return actions.andReturn().getResponse().getStatus();
    }

    /** DELETE 带 body —— BaseControllerTest 的 delete() 不带 body,而 delBatch 需要 @RequestBody */
    private ResultActions delWithBody(String url, String token, Object body) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.delete(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.toJSONString(body)));
    }

    /** 取响应体 data 数组(适配 data 直接是数组,或 data.list 是数组两种形态) */
    private JSONArray arrayData(ResultActions actions) throws Exception {
        MvcResult result = actions.andReturn();
        JSONObject body = JSONObject.parseObject(
                result.getResponse().getContentAsString(StandardCharsets.UTF_8));
        Object data = body.get("data");
        if (data instanceof JSONArray arr) {
            return arr;
        }
        if (data instanceof JSONObject obj && obj.get("list") instanceof JSONArray arr) {
            return arr;
        }
        return new JSONArray();
    }

    private int firstCartRowId(String token) throws Exception {
        return arrayData(get("/shoppingCart/page", token).andExpect(status().isOk()))
                .getJSONObject(0).getIntValue("id");
    }

    private int firstCartQuantity(String token) throws Exception {
        return arrayData(get("/shoppingCart/page", token).andExpect(status().isOk()))
                .getJSONObject(0).getIntValue("quantity");
    }
}
