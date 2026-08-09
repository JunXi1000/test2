package com.project.platform.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests for /products storefront endpoints.
 */
class ProductControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /products — should return product list")
    void listProducts() throws Exception {
        get("/products", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("GET /products/1 — should return product by ID")
    void getProductById() throws Exception {
        get("/products/1", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.name").value("Test Product 1"));
    }

    @Test
    @DisplayName("GET /products/999 — should handle non-existent product gracefully")
    void getProductNotFound() throws Exception {
        get("/products/999", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /products?category=Electronics — should filter by category")
    void listByCategory() throws Exception {
        get("/products?category=Electronics", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /products?q=Test — should search by keyword")
    void searchProducts() throws Exception {
        get("/products?q=Test", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("GET /products/category-counts — should return category counts")
    void categoryCounts() throws Exception {
        get("/products/category-counts", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
