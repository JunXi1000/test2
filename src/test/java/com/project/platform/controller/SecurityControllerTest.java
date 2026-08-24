package com.project.platform.controller;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Phase A 安全加固回归用例:
 * 注册白名单、角色收紧(/admin /user /productOrder)、重置密码越权、找回密码验证码全流程。
 */
class SecurityControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("匿名注册 ADMIN 应 403(杜绝匿名建管理员)")
    void registerAdminRejected() throws Exception {
        put("/common/register", "", Map.of(
                "type", "ADMIN",
                "username", "eviladmin",
                "password", "123456",
                "nickname", "Evil"
        )).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("普通用户调 /common/resetPassword 应 403(重置他人密码为后台能力)")
    void resetPasswordByUserForbidden() throws Exception {
        post("/common/resetPassword?type=USER&id=1", userToken(), null)
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /common/retrievePassword — 无验证码应 4xx")
    void retrievePasswordWithoutCode() throws Exception {
        post("/common/retrievePassword", "",
                Map.of("type", "USER", "tel", "13800000001", "password", "whatever"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("找回密码全流程: sendResetCode → retrievePassword → 新密码可登录、旧密码被拒")
    void resetPasswordFullFlow() throws Exception {
        // 1) 向 user2 手机号发送验证码(演示环境直接返回验证码)
        var codeResult = post("/common/sendResetCode", "",
                Map.of("type", "USER", "tel", "13800000002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        String code = JsonPath.read(
                codeResult.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.data");

        // 2) 用验证码重置 user2 的密码
        post("/common/retrievePassword", "",
                Map.of("type", "USER", "tel", "13800000002",
                        "code", code, "password", "newpass123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        // 3) 新密码可登录, 旧密码被拒
        post("/common/login", "",
                Map.of("username", "user2", "password", "newpass123", "type", "USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        post("/common/login", "",
                Map.of("username", "user2", "password", "123456", "type", "USER"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("USER 访问 /user/**、/productOrder/** 应 403(收紧为仅管理员)")
    void userCannotAccessAdminOnlyPaths() throws Exception {
        get("/user/list", userToken()).andExpect(status().isForbidden());
        get("/productOrder/list", userToken()).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("SHOP 访问 /admin/** 应 403")
    void shopCannotAccessAdminPaths() throws Exception {
        get("/admin/users", shopToken()).andExpect(status().isForbidden());
    }
}
