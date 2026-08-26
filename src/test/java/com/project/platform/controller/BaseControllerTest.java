package com.project.platform.controller;

import com.alibaba.fastjson2.JSON;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.utils.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * Base class for controller integration tests.
 * Provides JWT token generation and common HTTP helpers.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class BaseControllerTest {

    @Autowired
    protected MockMvc mockMvc;

    protected String adminToken() {
        return token(1, "ADMIN", "admin");
    }

    protected String userToken() {
        return token(1, "USER", "user1");
    }

    protected String user2Token() {
        return token(2, "USER", "user2");
    }

    protected String shopToken() {
        return token(1, "SHOP", "shop1");
    }

    protected String shop2Token() {
        return token(2, "SHOP", "shop2");
    }

    private String token(int id, String type, String username) {
        CurrentUserDTO dto = new CurrentUserDTO();
        dto.setId(id);
        dto.setType(type);
        dto.setUsername(username);
        return JwtUtils.generateToken(dto);
    }

    protected ResultActions get(String url, String token) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.get(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON));
    }

    protected ResultActions post(String url, String token, Object body) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.post(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.toJSONString(body)));
    }

    protected ResultActions put(String url, String token, Object body) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.put(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.toJSONString(body)));
    }

    protected ResultActions delete(String url, String token) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.delete(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON));
    }
}
