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
 * 授权模型基线 —— Phase 1「默认拒绝 + 显式放行」的靶子与回归网。
 *
 * 四段语义不同,**不要混读**:
 *
 * <ul>
 *   <li><b>A. 合法访问矩阵</b> —— 前端真正在用的端点。Phase 1 之后必须**仍然全绿**,是防「改坏了」的网。</li>
 *   <li><b>B. 真洞:无任何守卫的遗留端点</b> —— Phase 1 之后必须**全部翻转为 403**。
 *       这些现在是缺陷存证,不是期望行为。</li>
 *   <li><b>C. 已正确的行为</b> —— 服务层已有角色守卫/归属过滤。**Phase 1 之后必须保持不变**,
 *       别把已经对的改坏。</li>
 *   <li><b>D. 对象级越权(IDOR)</b> —— 授权层放行且归属校验缺失。Phase 1a 的默认拒绝关掉
 *       「前端不调用」的那批,Phase 1b 修剩下的(chat)。</li>
 * </ul>
 *
 * <b>现状成因</b>(两层,缺一不可):
 * <ol>
 *   <li>授权层:{@code LoginInterceptor.checkRole} 只对 {@code /admin}、{@code /merchant/}、
 *       {@code /user}、{@code /productOrder} 四个前缀判角色,**其余一律 {@code return true}**。
 *       注意前缀碰撞:{@code startsWith("/admin")} 顺带命中 {@code /admin-accounts/**};
 *       {@code startsWith("/productOrder")} 顺带命中 {@code /productOrderEvaluate/**}。</li>
 *   <li>服务层:守卫是**不完整**的 —— 同一个 service 里 {@code page()} 按 userId 过滤,
 *       而 {@code list()} 不过滤;{@code insert()} 判角色,而 {@code updateById()}/
 *       {@code removeByIds()} 不判。{@code ProductTypeServiceImpl} / {@code SlideshowServiceImpl} /
 *       {@code AdvertisingServiceImpl} 更是**一处守卫都没有**。</li>
 * </ol>
 *
 * 判据说明:B 段的断言形式是「**没有被授权层拦截**」(非 401/403)而不是「返回 200」,
 * 这样只针对授权这一件事。写操作统一传 {@code [-1]}(合法 SQL、影响 0 行),
 * 避免空列表生成 {@code id IN ()} 而导致靠 500 蒙混过关。
 */
class AuthorizationBaselineTest extends BaseControllerTest {

    // ═══════════════════════ A. 合法访问矩阵(Phase 1 后必须保持) ═══════════════════════

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
    @DisplayName("A. SHOP 可访问商家后台")
    void shopEndpointsStayOpen() throws Exception {
        String token = shopToken();
        for (String url : new String[]{"/merchant/products", "/merchant/dashboard/stats",
                "/merchant/orders", "/merchant/wallet", "/merchant/settings"}) {
            get(url, token)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(200));
        }
    }

    @Test
    @DisplayName("A. ADMIN 可访问管理后台")
    void adminEndpointsStayOpen() throws Exception {
        String token = adminToken();
        for (String url : new String[]{"/admin/users", "/admin/dashboard/stats", "/admin/merchants",
                "/admin/products", "/admin/orders", "/admin/reviews"}) {
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

    // ═══════════ B. 真洞:无任何守卫的遗留端点(Phase 1 后必须全部翻转为 403) ═══════════

    @Test
    @DisplayName("B.【当前缺陷】USER 读得到无守卫遗留端点 —— 含首页内容(轮播/广告)与全表数据")
    void userCanReadUnguardedLegacyLists() throws Exception {
        String token = userToken();
        String[] endpoints = {
                "/slideshow/list",              // 店铺首页轮播,0 处守卫 → 内容可被任意用户读写
                "/advertising/list",            // 广告位,0 处守卫
                "/productType/list",            // 商品分类,0 处守卫
                "/shop/list",
                "/product/list",
                "/shippingAddress/list",        // list() 无 userId 过滤(page() 有)→ 全表地址
                "/productCollect/list",         // 同上:page() 有过滤,list() 没有
                "/shopCollect/list",
                "/productBrowsingHistory/list"
        };
        for (String url : endpoints) {
            assertAuthorizerDidNotBlock(get(url, token), "USER GET " + url);
        }
    }

    @Test
    @DisplayName("B.【当前缺陷】USER 能调用无守卫遗留端点的写方法")
    void userCanReachUnguardedLegacyWrites() throws Exception {
        String token = userToken();
        // 传 -1:合法 SQL、影响 0 行,所以能把「授权放行且语句执行了」钉成确定的 200
        for (String url : new String[]{"/slideshow/delBatch", "/advertising/delBatch",
                "/shippingAddress/delBatch", "/product/delBatch", "/shop/delBatch",
                "/productCollect/delBatch", "/productType/delBatch"}) {
            delWithBody(url, token, List.of(-1))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(200));
        }
    }

    @Test
    @DisplayName("B.【当前缺陷·最严重】user2 读得到 user1 的收货地址 —— 不只是放行,数据真的泄漏了")
    void crossUserAddressDataActuallyLeaks() throws Exception {
        // schema-h2.sql 里 shipping_address id=1 属于 user_id=1,地址 123 Main St
        JSONArray rows = arrayData(get("/shippingAddress/list", user2Token()));
        assertFalse(rows.isEmpty(), "user2 应看不到任何地址 —— 若能拿到数据即为泄漏");
        boolean sawUser1Address = rows.stream()
                .map(o -> ((JSONObject) o))
                .anyMatch(o -> "123 Main St".equals(o.getString("address")));
        assertTrue(sawUser1Address,
                "当前缺陷:user2 通过 /shippingAddress/list 读到了 user1 的收货地址(姓名/电话/地址均属个人信息)");
    }

    // ═══════════ C. 已正确的行为(Phase 1 后必须保持不变,别改坏) ═══════════

    @Test
    @DisplayName("C. 服务层守卫存在:USER 建商品被服务层拒绝(409)、shopId 由服务端覆写")
    void userCannotCreateProductServiceLayerGuardsIt() throws Exception {
        // ProductServiceImpl.insert:非 SHOP 抛 CustomException(默认 409),且 setShopId 取自 token
        post("/product/add", userToken(), Map.of(
                "name", "不该被创建的商品", "mainImg", "/img/x.jpg", "productTypeId", 1,
                "price", 1.00, "stock", 1, "salesVolume", 0, "shopId", 2))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));
    }

    @Test
    @DisplayName("C. /user/** 与 /productOrder/** 已被上一轮加固收紧为 ADMIN")
    void legacyAdminPrefixesAreAlreadyTight() throws Exception {
        get("/user/list", userToken()).andExpect(status().isForbidden());
        get("/productOrder/list", userToken()).andExpect(status().isForbidden());
        // 同一端点 ADMIN 可用,证明没被误伤
        get("/user/list", adminToken()).andExpect(status().isOk());
    }

    @Test
    @DisplayName("C. 前缀碰撞:/admin-accounts/** 与 /productOrderEvaluate/** 被顺带收紧为 ADMIN")
    void prefixCollisionTightensTwoUnrelatedControllers() throws Exception {
        // startsWith("/admin") 顺带命中 /admin-accounts;startsWith("/productOrder") 顺带命中 /productOrderEvaluate
        // 这不是设计,是前缀匹配的副作用 —— Phase 1a 的显式路由表会让它变成显式决定
        get("/admin-accounts/page", userToken()).andExpect(status().isForbidden());
        get("/productOrderEvaluate/list", userToken()).andExpect(status().isForbidden());
        get("/admin-accounts/page", adminToken()).andExpect(status().isOk());
    }

    @Test
    @DisplayName("C. 购物车 4 个在用端点全有归属守卫(user2 改不动 user1 的行)")
    void shoppingCartEndpointsAreGuarded() throws Exception {
        post("/shoppingCart/add", userToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isOk());
        int rowId = firstCartRowId(userToken());
        put("/shoppingCart/update", user2Token(), Map.of("id", rowId, "quantity", 99))
                .andExpect(status().isForbidden());
    }

    // ═══════════════════ D. 对象级越权(IDOR) ═══════════════════

    @Test
    @DisplayName("D.【当前缺陷】user2 按 id 读他人地址(端点前端不调用 → Phase 1a 默认拒绝关闭)")
    void crossUserAddressReadById() throws Exception {
        assertAuthorizerDidNotBlock(get("/shippingAddress/selectById/1", user2Token()),
                "user2 GET /shippingAddress/selectById/1");
    }

    @Test
    @DisplayName("D.【当前缺陷】user2 按 id 读他人购物车行/用它下单(端点前端不调用 → Phase 1a 关闭)")
    void crossUserCartAccessViaUnusedEndpoints() throws Exception {
        post("/shoppingCart/add", userToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isOk());
        int user1RowId = firstCartRowId(userToken());

        assertAuthorizerDidNotBlock(get("/shoppingCart/selectById/" + user1RowId, user2Token()),
                "user2 GET /shoppingCart/selectById/{user1RowId}");

        // createOrder 内部对 shoppingCartId 无归属校验,且删除走的是不带 userId 过滤的 removeByIds
        assertAuthorizerDidNotBlock(
                post("/shoppingCart/createOrder", user2Token(), Map.of(
                        "ids", List.of(user1RowId),
                        "consigneeName", "attacker",
                        "consigneeTel", "000",
                        "consigneeAddress", "nowhere")),
                "user2 POST /shoppingCart/createOrder (user1 的购物车行 id)");
    }

    @Test
    @DisplayName("D.【当前缺陷】user2 读任意会话的消息(chat 是前端在用端点 → Phase 1b 补归属校验)")
    void crossUserConversationRead() throws Exception {
        assertAuthorizerDidNotBlock(get("/chat/conversations/1/messages", user2Token()),
                "user2 GET /chat/conversations/1/messages");
    }

    // ─────────────────────────── helpers ───────────────────────────

    private int statusOf(ResultActions actions) throws Exception {
        return actions.andReturn().getResponse().getStatus();
    }

    /**
     * 断言「授权层没有拦截」:既不是 401 也不是 403。
     * 刻意不写成 200 —— 只针对授权这一件事,不被业务规则(如 409)之类的其他原因污染。
     * Phase 1 之后这些调用点应改为 {@code assertEquals(403, statusOf(...))}。
     */
    private void assertAuthorizerDidNotBlock(ResultActions actions, String what) throws Exception {
        int status = statusOf(actions);
        assertNotEquals(401, status, what + " —— 认证层拦住了(不该只有认证层拦)");
        assertNotEquals(403, status,
                what + " —— 授权层拦住了。若此处失败,说明 Phase 1 的收口已生效,请把断言翻转为 403");
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
}
