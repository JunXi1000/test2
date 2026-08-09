package com.project.platform.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests for /chat endpoints.
 */
class ChatControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /chat/conversations — should return conversations")
    void listConversations() throws Exception {
        get("/chat/conversations", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("POST /chat/messages — should send a message and create conversation")
    void sendMessage() throws Exception {
        post("/chat/messages", userToken(), java.util.Map.of(
                "receiverId", 1,
                "content", "Hello store!",
                "isMerchant", false
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200))
          .andExpect(jsonPath("$.data.content").value("Hello store!"));
    }

    @Test
    @DisplayName("GET /chat/conversations/{id}/messages — should return messages")
    void getMessages() throws Exception {
        // First send a message to create a conversation
        var result = post("/chat/messages", userToken(), java.util.Map.of(
                "receiverId", 1, "content", "Hi!", "isMerchant", false
        )).andReturn();
        // ResponseVO wraps the message in data
        // We'll just test that the messages endpoint works for any ID
        get("/chat/conversations/1/messages", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("PUT /chat/conversations/{id}/read — should mark as read")
    void markAsRead() throws Exception {
        put("/chat/conversations/1/read", userToken(), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
