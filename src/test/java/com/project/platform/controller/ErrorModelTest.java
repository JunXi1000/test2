package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 错误模型回归网 —— 覆盖 Phase 3 补上的 5 个异常处理器,以及 {@code ResponseVO.fail} 的**双写过渡**。
 *
 * <p><b>为什么需要它</b>:这 5 类异常此前**没有处理器**,一律落入通用 {@code Exception} 分支被报成
 * <b>500</b>。把客户端错误报成 500 会让前端与运维都误判(500 意味着服务端故障),并掩盖真实语义。
 * 补处理器若不配测试,只是把 500 换成一个未经验证的分支。
 *
 * <p><b>双写过渡</b>(Phase 3a):{@code ResponseVO.fail} 现在把原因**同时**写进 {@code msg} 与
 * {@code data}。此前 {@code msg} 恒为字面量 {@code "操作失败"},前端 {@code http.ts} 只能从
 * {@code data} 里取原因。对前端是纯增量:继续读 {@code data} 完全有效 —— {@link #failWritesReasonToBothFields()}
 * 把这条契约钉住,将来收敛为「msg 放原因、data 只放业务数据」时它会失败,提醒同步改前端。
 */
class ErrorModelTest extends BaseControllerTest {

    // ─────────────────────── 5 个新增异常处理器(此前都是 500) ───────────────────────

    @Test
    @DisplayName("请求体畸形 → 400(此前 500)")
    void malformedJsonIsBadRequest() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.post("/common/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ this is not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("请求体格式不正确"));
    }

    @Test
    @DisplayName("路径参数类型不匹配 → 400(此前 500)")
    void pathVariableTypeMismatchIsBadRequest() throws Exception {
        // /addresses/{id} 期望 Integer,传 "abc"
        put("/addresses/abc", userToken(), Map.of())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("缺少必填查询参数 → 400(此前 500)")
    void missingRequiredParameterIsBadRequest() throws Exception {
        // /common/resetPassword 需要 type 与 id 两个 @RequestParam
        mockMvc.perform(MockMvcRequestBuilders.post("/common/resetPassword")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("HTTP 方法不支持 → 405(此前 500)")
    void unsupportedMethodIsMethodNotAllowed() throws Exception {
        // /products 只有 GET(且在白名单里,不经过拦截器)
        mockMvc.perform(MockMvcRequestBuilders.delete("/products"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(405));
    }

    @Test
    @DisplayName("找不到处理器 → 404(此前 500)")
    void noHandlerIsNotFound() throws Exception {
        // 走 /search/** 是因为它在白名单里(excludePathPatterns),不经过拦截器。
        // 未知路径若不在白名单,会被拦截器先拒(匿名 401 / 已登录 403)而到不了这里:
        // Spring 把 /** 映射到 ResourceHttpRequestHandler 时**不限方法**,方法检查在 handler 内部,
        // 所以 getHandler() 对任何路径都会成功,拦截器因此总有得跑。
        mockMvc.perform(MockMvcRequestBuilders.get("/search/no-such-thing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.msg").value("接口不存在"));
    }

    // ─────────────────────── 参数校验类错误的语义未变 ───────────────────────

    @Test
    @DisplayName("Bean 校验失败仍是 400(未受本次改动影响)")
    void beanValidationStillReturnsBadRequest() throws Exception {
        // LoginDTO 带 @NotBlank/@Pattern,空体触发 MethodArgumentNotValidException
        post("/common/login", "", Map.of())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    // ─────────────────────── 双写过渡 ───────────────────────

    @Test
    @DisplayName("fail 把原因同时写进 msg 与 data(双写过渡的契约)")
    void failWritesReasonToBothFields() throws Exception {
        // 登录密码错误 → CustomException(默认 409),原因文案是 "用户名或密码错误"
        MvcResult result = post("/common/login", "", Map.of(
                "type", "USER", "username", "user1", "password", "definitely-wrong"))
                .andExpect(status().isConflict())
                .andReturn();
        JSONObject body = JSONObject.parseObject(
                result.getResponse().getContentAsString(StandardCharsets.UTF_8));

        String reason = body.getString("data");
        assertEquals("用户名或密码错误", reason, "data 必须继续携带具体原因(前端依赖这一点)");
        assertEquals(reason, body.getString("msg"),
                "msg 也必须带同一句原因 —— 此前它恒为字面量「操作失败」,契约层面形同废弃");
    }

    @Test
    @DisplayName("成功响应的 msg 仍是「操作成功」,未受影响")
    void successMessageUnchanged() throws Exception {
        get("/orders", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.msg").value("操作成功"));
    }

    @Test
    @DisplayName("未知路径仍不泄漏存在性(Phase 1a 的 403/401 语义未被 404 处理器改变)")
    void unknownPathStillDoesNotLeak() throws Exception {
        // GET /no/such 会被静态资源处理器认领 → 拦截器先跑 → 已登录 403
        int authenticated = mockMvc.perform(MockMvcRequestBuilders.get("/no/such/endpoint")
                        .header("Authorization", "Bearer " + userToken()))
                .andReturn().getResponse().getStatus();
        assertNotEquals(404, authenticated,
                "已登录访问未知 GET 路径应是 403(拦截先于 handler 解析),不该变成 404");
    }
}
