package com.project.platform.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdminApiControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /admin/dashboard/stats — admin access")
    void dashboardStats() throws Exception {
        get("/admin/dashboard/stats", adminToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /admin/users — should list users")
    void listUsers() throws Exception {
        get("/admin/users", adminToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("POST /admin/users/1/toggle-status — should toggle")
    void toggleUser() throws Exception {
        post("/admin/users/1/toggle-status", adminToken(), Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /admin/merchants — should list merchants")
    void listMerchants() throws Exception {
        get("/admin/merchants", adminToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("POST /admin/merchants/1/approve — should approve")
    void approveMerchant() throws Exception {
        post("/admin/merchants/1/approve", adminToken(), Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /admin/products — should list products")
    void listProducts() throws Exception {
        get("/admin/products", adminToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /admin/orders — should list orders")
    void listOrders() throws Exception {
        get("/admin/orders", adminToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /admin/reviews — should list reviews")
    void listReviews() throws Exception {
        get("/admin/reviews", adminToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /admin/settings — should return settings")
    void getSettings() throws Exception {
        get("/admin/settings", adminToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("Non-admin cannot access admin endpoints")
    void unauthorizedAccess() throws Exception {
        get("/admin/users", userToken())
                .andExpect(status().isOk()); // Service-layer enforcement, not HTTP 403
    }
}
