package com.project.platform.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AddressControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /addresses — should return addresses")
    void listAddresses() throws Exception {
        get("/addresses", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("POST /addresses — should create address")
    void createAddress() throws Exception {
        post("/addresses", userToken(), Map.of(
                "name", "Office",
                "tel", "123456789",
                "address", "456 Work St",
                "userId", 1
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("PUT /addresses/1 — should update address")
    void updateAddress() throws Exception {
        put("/addresses/1", userToken(), Map.of(
                "name", "Updated Home",
                "tel", "99999999",
                "address", "789 New St"
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("PUT /addresses/1/default — should set default")
    void setDefault() throws Exception {
        put("/addresses/1/default", userToken(), Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("DELETE /addresses/1 — should delete address")
    void deleteAddress() throws Exception {
        delete("/addresses/1", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
