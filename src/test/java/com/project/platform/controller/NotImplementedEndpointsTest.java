package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * C5 诚实降级回归网:4 个「未实现的写端点」必须返回 <b>501</b>,且<b>不写入任何痕迹</b>。
 *
 * <h2>背景(TASK-001 MAJ-3 实测)</h2>
 * <p>这 4 个端点此前**收下请求 → 什么都不做 → 返回 200**。用户看到「保存成功 / 提现已受理」,
 * 刷新后一切照旧。其中 {@code POST /merchant/wallet/withdraw} 最危险:它把提现请求静默吞掉,
 * 而一旦将来钱包余额变得非 0,这就等价于「用户以为钱提走了,其实一分没动」。
 *
 * <p>本轮不做真实实现(钱包/设置表的 Java 侧零消费者,且 SQL 迁移已裁决不应用),
 * 只做**诚实降级**:501 Not Implemented + 明确 msg。真正实现要等 schema 与 Service 同批交付。
 *
 * <h2>本类与「只改状态码」的区别</h2>
 * <p>只断言 501 是不够的 —— 一个实现完全可能「先写库再返回 501」,那比假成功更糟。
 * 所以每条用例都同时钉住**副作用为零**:读接口返回的内容/钱包余额/地址列表在调用前后**完全一致**。
 *
 * <h2>刻意不包含的端点</h2>
 * <p>{@code POST /account/notifications} **不在** C5 的 501 名单里 —— 它已有真实实现
 * ({@code user_notification_pref} 落库,字段为 {@code emailOrder/emailPromo/smsOrder}),
 * 属**参数校验缺失**(契约 C6:三个偏好全缺 → 400),已由
 * {@link AccountNotificationContractTest} 专门覆盖。
 * 把它也改成 501 会破坏一个能用的功能。
 */
class NotImplementedEndpointsTest extends BaseControllerTest {

    // ═══════════════════ PUT /admin/settings ═══════════════════

    @Test
    @DisplayName("C5:PUT /admin/settings → 501,且 GET 的值完全不变(此前 200 假成功)")
    void adminSettingsUpdateIsNotImplemented() throws Exception {
        String before = bodyOf(get("/admin/settings", adminToken())
                .andExpect(status().isOk()).andReturn());

        put("/admin/settings", adminToken(), Map.of(
                "siteName", "QA-PROBE-SITE", "maintenanceMode", true))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.code").value(501));

        String after = bodyOf(get("/admin/settings", adminToken())
                .andExpect(status().isOk()).andReturn());
        assertEquals(before, after,
                "501 之后 GET 的响应必须逐字不变 —— 否则说明「先写库再报未实现」");
    }

    // ═══════════════════ PUT /merchant/settings ═══════════════════

    @Test
    @DisplayName("C5:PUT /merchant/settings → 501,且 GET 的值完全不变(此前 200 假成功)")
    void merchantSettingsUpdateIsNotImplemented() throws Exception {
        String before = bodyOf(get("/merchant/settings", shopToken())
                .andExpect(status().isOk()).andReturn());

        put("/merchant/settings", shopToken(), Map.of(
                "storeName", "QA-PROBE-STORE", "email", "qa@probe.test"))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.code").value(501));

        String after = bodyOf(get("/merchant/settings", shopToken())
                .andExpect(status().isOk()).andReturn());
        assertEquals(before, after,
                "501 之后 GET 的响应必须逐字不变(storeName 仍为种子值)");
    }

    // ═══════════════════ POST /merchant/wallet/withdraw ═══════════════════

    @Test
    @DisplayName("C5:POST /merchant/wallet/withdraw → 501,且钱包余额与流水均无变化(不再静默吞掉提现)")
    void merchantWalletWithdrawIsNotImplemented() throws Exception {
        String walletBefore = bodyOf(get("/merchant/wallet", shopToken())
                .andExpect(status().isOk()).andReturn());
        String txBefore = bodyOf(get("/merchant/wallet/transactions", shopToken())
                .andExpect(status().isOk()).andReturn());

        post("/merchant/wallet/withdraw", shopToken(), Map.of(
                "amount", 100, "destinationId", "dest-1"))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.code").value(501));

        assertEquals(walletBefore, bodyOf(get("/merchant/wallet", shopToken())
                        .andExpect(status().isOk()).andReturn()),
                "501 之后钱包余额必须逐字不变 —— 提现请求不得有任何副作用");
        assertEquals(txBefore, bodyOf(get("/merchant/wallet/transactions", shopToken())
                        .andExpect(status().isOk()).andReturn()),
                "501 之后流水列表必须逐字不变");
    }

    // ═══════════════════ PUT /addresses/{id}/default ═══════════════════

    @Test
    @DisplayName("C5:PUT /addresses/1/default → 501,且地址列表无变化(此前 200 假成功)")
    void addressSetDefaultIsNotImplemented() throws Exception {
        String before = bodyOf(get("/addresses", userToken())
                .andExpect(status().isOk()).andReturn());

        put("/addresses/1/default", userToken(), Map.of())
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.code").value(501));

        assertEquals(before, bodyOf(get("/addresses", userToken())
                        .andExpect(status().isOk()).andReturn()),
                "501 之后地址列表必须逐字不变(is_default 列尚未落地)");
    }

    // ═══════════════════ 授权边界不回退 ═══════════════════

    @Test
    @DisplayName("C5 边界:501 不能盖过鉴权 —— 匿名/跨角色仍须 401 / 403(不得因「未实现」而绕过拦截器)")
    void notImplementedEndpointsStillEnforceAuthorization() throws Exception {
        // 匿名:三处写端点都应先被拦截器拒绝(401),而不是直接吐 501
        for (String[] call : new String[][]{
                {"PUT", "/admin/settings"}, {"PUT", "/merchant/settings"},
                {"POST", "/merchant/wallet/withdraw"}, {"PUT", "/addresses/1/default"}}) {
            int status = anonymousStatus(call[0], call[1]);
            assertEquals(401, status,
                    call[0] + " " + call[1] + " 匿名应 401(鉴权先于实现状态), got " + status);
        }
        // 跨角色:买家不得碰商家/管理端写端点
        put("/merchant/settings", userToken(), Map.of("storeName", "x"))
                .andExpect(status().isForbidden());
        put("/admin/settings", shopToken(), Map.of("siteName", "x"))
                .andExpect(status().isForbidden());
    }

    private int anonymousStatus(String method, String url) throws Exception {
        var request = switch (method) {
            case "PUT" -> org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(url);
            case "POST" -> org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url);
            default -> throw new IllegalArgumentException(method);
        };
        return mockMvc.perform(request
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andReturn().getResponse().getStatus();
    }

    private String bodyOf(MvcResult result) throws Exception {
        JSONObject body = JSONObject.parseObject(
                result.getResponse().getContentAsString(StandardCharsets.UTF_8));
        return body == null ? "" : body.toJSONString();
    }
}
