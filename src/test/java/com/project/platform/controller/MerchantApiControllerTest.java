package com.project.platform.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MerchantApiControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /merchant/dashboard/stats — shop access")
    void dashboardStats() throws Exception {
        get("/merchant/dashboard/stats", shopToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /merchant/dashboard/low-stock — should return low stock")
    void lowStock() throws Exception {
        get("/merchant/dashboard/low-stock", shopToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /merchant/products — should list shop products")
    void listProducts() throws Exception {
        get("/merchant/products", shopToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("POST /merchant/products — should create product")
    void createProduct() throws Exception {
        post("/merchant/products", shopToken(), Map.of(
                "name", "New Product",
                "price", 49.99,
                "stock", 100,
                "productTypeId", 1
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /merchant/orders — should list shop orders")
    void listOrders() throws Exception {
        get("/merchant/orders", shopToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /merchant/wallet — should return wallet info")
    void wallet() throws Exception {
        get("/merchant/wallet", shopToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /merchant/settings — should return shop settings")
    void settings() throws Exception {
        get("/merchant/settings", shopToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /merchants/1/profile — public access works")
    void publicProfile() throws Exception {
        get("/merchants/1/profile", "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
