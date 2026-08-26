package com.project.platform.controller;

import com.jayway.jsonpath.JsonPath;
import com.project.platform.mapper.UserMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 登录/注册/当前用户功能测试(成功 + 失败场景全覆盖)。
 *
 * 覆盖:
 *  - 登录: 成功 / 错密码 / 不存在用户(不泄露) / 非法类型 / 用户名 trim 归一
 *  - 注册: 成功 / 重复用户名 / 空白用户名 / 弱密码 / 非法邮箱(服务端二次校验)
 *  - 当前用户: 有效 token / 无效 token / 未携带 token(统一 401 JSON 错误体)
 *  - 集成: 注册 → 登录 → 访问受保护接口 全流程
 *  - 越权回归: /common/updateCurrentUser 提交他人 id 应被忽略(只改自己)
 *  - 找回密码: 邮箱注册(无 tel)用户可凭邮箱重置密码(selectByTel 兜底匹配 email)
 */
class AuthFlowTest extends BaseControllerTest {

    @Autowired
    private UserMapper userMapper;

    /** 注册并登录,返回真实 JWT */
    private String registerAndGetToken(String username, String email, String password) throws Exception {
        put("/common/register", "", Map.of(
                "type", "USER",
                "username", username,
                "password", password,
                "nickname", "Flow User",
                "email", email
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200));

        var loginResult = post("/common/login", "", Map.of(
                "username", username, "password", password, "type", "USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return JsonPath.read(
                loginResult.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.data");
    }

    // ── 登录 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("登录:不存在用户应 409 且提示与错密码一致(不泄露用户是否存在)")
    void loginUnknownUserRejected() throws Exception {
        post("/common/login", "", Map.of("username", "no_such_user", "password", "whatever", "type", "USER"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.data").value("用户名或密码错误"));
    }

    @Test
    @DisplayName("登录:用户类型非法应 400(Bean Validation)")
    void loginInvalidTypeRejected() throws Exception {
        post("/common/login", "", Map.of("username", "user1", "password", "123456", "type", "FOO"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("登录:用户名带首尾空格仍可登录(trim 归一)")
    void loginTrimsUsername() throws Exception {
        post("/common/login", "", Map.of("username", "  user1  ", "password", "123456", "type", "USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    // ── 注册 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("注册:重复用户名应 409")
    void registerDuplicateUsernameRejected() throws Exception {
        put("/common/register", "", Map.of(
                "type", "USER", "username", "user1", "password", "123456",
                "nickname", "Dup", "email", "dup@example.com"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.data").value("用户名已存在"));
    }

    @Test
    @DisplayName("注册:空白用户名应 400")
    void registerBlankUsernameRejected() throws Exception {
        put("/common/register", "", Map.of(
                "type", "USER", "username", "   ", "password", "123456",
                "nickname", "Blank", "email", "blank@example.com"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("注册:弱密码(<6 位)应 400")
    void registerWeakPasswordRejected() throws Exception {
        put("/common/register", "", Map.of(
                "type", "USER", "username", "weakpwd", "password", "123",
                "nickname", "Weak", "email", "weak@example.com"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("注册:非法邮箱应 400")
    void registerInvalidEmailRejected() throws Exception {
        put("/common/register", "", Map.of(
                "type", "USER", "username", "bademail", "password", "123456",
                "nickname", "Bad", "email", "not-an-email"))
                .andExpect(status().isBadRequest());
    }

    // ── 当前用户 ──────────────────────────────────────────────────

    @Test
    @DisplayName("currentUser:无效 token 应 401 且返回统一 JSON 错误体")
    void currentUserInvalidTokenRejected() throws Exception {
        get("/common/currentUser", "not.a.real.token")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @DisplayName("currentUser:未携带 token 应 401(与无效 token 同格式)")
    void currentUserNoTokenRejected() throws Exception {
        get("/common/currentUser", "")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    // ── 集成全流程 ────────────────────────────────────────────────

    @Test
    @DisplayName("集成:注册 → 登录 → 访问受保护接口(获取当前用户)")
    void fullRegisterLoginCurrentUserFlow() throws Exception {
        String token = registerAndGetToken("flowuser", "flow@example.com", "abc12345");

        get("/common/currentUser", token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.username").value("flowuser"))
                .andExpect(jsonPath("$.data.email").value("flow@example.com"));
    }

    // ── 水平越权回归 ──────────────────────────────────────────────

    @Test
    @DisplayName("updateCurrentUser:提交他人 id 应被忽略,只改自己(越权回归)")
    void updateCurrentUserIgnoresForeignId() throws Exception {
        // user2 尝试提交 id=1(user1)的昵称/邮箱
        post("/common/updateCurrentUser", user2Token(), Map.of(
                "id", 1, "nickname", "HACKED", "email", "hacked@x.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        // user1 未被篡改
        assertEquals("Test User", userMapper.selectById(1).getNickname());
        assertEquals("user@test.com", userMapper.selectById(1).getEmail());
        // user2 自己的信息被更新(按 thread-local id=2,而非请求体 id=1)
        assertEquals("HACKED", userMapper.selectById(2).getNickname());
    }

    // ── 邮箱找回密码 ──────────────────────────────────────────────

    @Test
    @DisplayName("找回密码:邮箱注册(无 tel)用户可凭邮箱重置密码")
    void emailBasedPasswordReset() throws Exception {
        String email = "resetbyemail@example.com";
        put("/common/register", "", Map.of(
                "type", "USER", "username", email, "password", "oldpass123",
                "nickname", "Reset By Email", "email", email))
                .andExpect(status().isOk());

        // 演示环境直接回显 6 位验证码
        var codeResult = post("/common/sendResetCode", "", Map.of("type", "USER", "tel", email))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        String code = JsonPath.read(
                codeResult.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.data");

        // 凭邮箱 + 验证码重置密码(该用户 tel 列为空,只能靠 email 列匹配)
        post("/common/retrievePassword", "", Map.of(
                "type", "USER", "tel", email, "code", code, "password", "newpass456"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        // 新密码可登录, 旧密码被拒
        post("/common/login", "", Map.of("username", email, "password", "newpass456", "type", "USER"))
                .andExpect(status().isOk());
        post("/common/login", "", Map.of("username", email, "password", "oldpass123", "type", "USER"))
                .andExpect(status().isConflict());
    }
}
