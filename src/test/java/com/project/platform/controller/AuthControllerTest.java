package com.project.platform.controller;

import com.project.platform.mapper.UserMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests for /common (auth) endpoints.
 */
class AuthControllerTest extends BaseControllerTest {

    @Autowired
    private UserMapper userMapper;

    @Test
    @DisplayName("POST /common/login — should authenticate with valid credentials")
    void loginSuccess() throws Exception {
        post("/common/login", "",
                java.util.Map.of("username", "user1", "password", "123456", "type", "USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isString());
    }

    @Test
    @DisplayName("POST /common/login — should fail with wrong password")
    void loginFail() throws Exception {
        post("/common/login", "",
                java.util.Map.of("username", "user1", "password", "wrong", "type", "USER"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("PUT /common/register — should register a new user and persist email")
    void registerUser() throws Exception {
        put("/common/register", "", java.util.Map.of(
                "type", "USER",
                "username", "newuser",
                "password", "123456",
                "nickname", "New User",
                "email", "newuser@example.com"
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200));
        // 回归:注册必须把 email 落入 user.email 列,否则管理端用户列表邮箱为空
        assertEquals("newuser@example.com", userMapper.selectByUsername("newuser").getEmail());
    }

    @Test
    @DisplayName("PUT /common/register — SHOP 匿名注册应 403(商家走入驻审核, 拒绝匿名建商户)")
    void registerShopRejected() throws Exception {
        put("/common/register", "", java.util.Map.of(
                "type", "SHOP",
                "username", "newshop",
                "password", "123456",
                "nickname", "Shop Owner",
                "name", "New Store",
                "aptitudeImgs", ""
        )).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /common/currentUser — should return current user info")
    void currentUser() throws Exception {
        get("/common/currentUser", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.username").value("user1"));
    }

    @Test
    @DisplayName("GET /common/currentUser — should reject unauthenticated")
    void currentUserUnauthenticated() throws Exception {
        get("/common/currentUser", "")
                .andExpect(status().isUnauthorized());
    }
}
