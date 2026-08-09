package com.project.platform.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OrderControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /orders — should return user orders")
    void listOrders() throws Exception {
        get("/orders", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("GET /orders/recent — should return recent orders")
    void recentOrders() throws Exception {
        get("/orders/recent", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /dashboard/stats — should return user dashboard stats")
    void dashboardStats() throws Exception {
        get("/dashboard/stats", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
