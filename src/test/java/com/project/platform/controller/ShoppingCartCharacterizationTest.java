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
 * 购物车端点的**特性化测试** —— 钉住重构前的真实行为。
 *
 * 这 4 个端点是**前端唯一真正调用的遗留 CRUD 端点**
 * (见 {@code web/src/api/modules/cart.ts}):{@code page} / {@code add} / {@code update} / {@code delBatch}。
 * 同 Controller 下的 {@code selectById} / {@code list} / {@code createOrder} 前端 0 引用,
 * 其越权面记录在 {@link AuthorizationBaselineTest}。
 *
 * Phase 1 的授权收口必须**放行**这 4 个端点,Phase 2 的唯一键
 * ({@code shopping_cart(user_id, product_id)})必须**保持**「同商品累加进同一行」的现有语义,
 * 本类就是这两件事的回归网。
 */
class ShoppingCartCharacterizationTest extends BaseControllerTest {

    @Test
    @DisplayName("前端在用的 4 个端点:add → page → update → delBatch 全链路")
    void addPageUpdateDelBatchRoundTrip() throws Exception {
        String token = userToken();

        post("/shoppingCart/add", token, Map.of("productId", 1, "quantity", 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        assertEquals(1, pageRows(token).size(), "add 后应有 1 行");

        int rowId = pageRows(token).getJSONObject(0).getIntValue("id");
        assertEquals(2, pageRows(token).getJSONObject(0).getIntValue("quantity"));

        put("/shoppingCart/update", token, Map.of("id", rowId, "quantity", 5))
                .andExpect(status().isOk());
        assertEquals(5, pageRows(token).getJSONObject(0).getIntValue("quantity"),
                "update 应改写数量");

        delWithBody("/shoppingCart/delBatch", token, List.of(rowId))
                .andExpect(status().isOk());
        assertTrue(pageRows(token).isEmpty(), "delBatch 后应为空");
    }

    @Test
    @DisplayName("同一商品重复 add 累加进同一行(Phase 2 加唯一键时必须保持)")
    void addSameProductTwiceSumsQuantityInOneRow() throws Exception {
        String token = userToken();

        post("/shoppingCart/add", token, Map.of("productId", 1, "quantity", 2)).andExpect(status().isOk());
        post("/shoppingCart/add", token, Map.of("productId", 1, "quantity", 3)).andExpect(status().isOk());

        JSONArray rows = pageRows(token);
        assertEquals(1, rows.size(), "同商品应累加进同一行,而不是新增第二行(先查后插的现有语义)");
        assertEquals(5, rows.getJSONObject(0).getIntValue("quantity"), "数量应为 2+3=5");
    }

    @Test
    @DisplayName("add 只允许 USER:SHOP/ADMIN 被授权层拒绝(403)")
    void addRejectedForNonUserRole() throws Exception {
        // 服务层 ShoppingCartServiceImpl.insert 另有「非 USER 抛 409」的守卫,但 Phase 1a 之后
        // 授权层更早一步拒绝(/shoppingCart/add 只登记给 USER),所以外部看到的是 403。
        // 服务层那条守卫保留为纵深防御,只是对非 USER 已不可达。
        post("/shoppingCart/add", shopToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        post("/shoppingCart/add", adminToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("page 只返回自己的行:user2 看不到 user1 的购物车")
    void pageIsScopedToCurrentUser() throws Exception {
        post("/shoppingCart/add", userToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isOk());

        assertTrue(pageRows(user2Token()).isEmpty(), "user2 的购物车应为空,不应看到 user1 的行");
    }

    @Test
    @DisplayName("update 越权被拒:user2 改不动 user1 的购物车行(403)")
    void updateOtherUsersCartRowForbidden() throws Exception {
        post("/shoppingCart/add", userToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isOk());
        int rowId = pageRows(userToken()).getJSONObject(0).getIntValue("id");

        put("/shoppingCart/update", user2Token(), Map.of("id", rowId, "quantity", 99))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        assertEquals(1, pageRows(userToken()).getJSONObject(0).getIntValue("quantity"),
                "user1 的数量不应被改动");
    }

    @Test
    @DisplayName("delBatch 只删自己的行:user2 传 user1 的行 id 删不掉")
    void delBatchOnlyRemovesOwnRows() throws Exception {
        post("/shoppingCart/add", userToken(), Map.of("productId", 1, "quantity", 1))
                .andExpect(status().isOk());
        int rowId = pageRows(userToken()).getJSONObject(0).getIntValue("id");

        delWithBody("/shoppingCart/delBatch", user2Token(), List.of(rowId))
                .andExpect(status().isOk());

        assertEquals(1, pageRows(userToken()).size(),
                "user2 的 delBatch 不应删掉 user1 的行(走 removeByIdsOfUser 按 userId 过滤)");
    }

    // ─────────────────────────── helpers ───────────────────────────

    /** DELETE 带 body —— BaseControllerTest 的 delete() 不带 body,而 delBatch 需要 @RequestBody */
    private ResultActions delWithBody(String url, String token, Object body) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.delete(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.toJSONString(body)));
    }

    /** GET /shoppingCart/page 的 data.list */
    private JSONArray pageRows(String token) throws Exception {
        MvcResult result = get("/shoppingCart/page", token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return JSONObject.parseObject(
                        result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data")
                .getJSONArray("list");
    }
}
