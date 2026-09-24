package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * /chat 端点测试。
 *
 * <p>原实现里 {@code getMessages} / {@code markAsRead} / {@code sendMessage} 都不校验会话归属,
 * 「任意 id 都能读」被这条测试的注释("works for any ID")固化成了预期行为 —— Phase 1b 已补上
 * 归属校验,本类相应改成:
 * <ul>
 *   <li>正例:参与者(买家或该店铺)可读;</li>
 *   <li>反例:非参与者 403,会话不存在 404。</li>
 * </ul>
 *
 * <p>{@code shopParticipantCanReadItsOwnConversation} 是**两套 id 空间的回归网**:
 * {@code user} 与 {@code shop} 是独立 id 空间(两边都有 id=1),若实现误把
 * {@code shop_id} 与会话的 {@code user_id} 比较,这条会以 shop2 被判非参与者而失败。
 */
class ChatControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /chat/conversations — 只返回自己的会话")
    void listConversations() throws Exception {
        get("/chat/conversations", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("POST /chat/messages — 发消息并建会话")
    void sendMessage() throws Exception {
        post("/chat/messages", userToken(), Map.of(
                "receiverId", 1,
                "content", "Hello store!"
        )).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.content").value("Hello store!"));
    }

    @Test
    @DisplayName("发送者身份取自 token:请求体里的 isMerchant 被忽略")
    void senderTypeComesFromTokenNotBody() throws Exception {
        // 买家伪造 isMerchant=true —— 仍必须以 USER 身份发出(user 与 shop 是两套 id 空间,
        // 采信客户端布尔等于允许伪造发送者)
        post("/chat/messages", userToken(), Map.of(
                "receiverId", 1,
                "content", "spoof attempt",
                "isMerchant", true
        )).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.senderType").value("USER"));
    }

    @Test
    @DisplayName("GET /chat/conversations/{id}/messages — 参与者可读")
    void getMessages() throws Exception {
        int conversationId = createConversation(userToken(), 1, "Hi!");
        get("/chat/conversations/" + conversationId + "/messages", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].content").value("Hi!"));
    }

    @Test
    @DisplayName("PUT /chat/conversations/{id}/read — 参与者可标记已读")
    void markAsRead() throws Exception {
        int conversationId = createConversation(userToken(), 1, "please read me");
        put("/chat/conversations/" + conversationId + "/read", userToken(), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("会话不存在 → 404(而非 200 空列表)")
    void missingConversationNotFound() throws Exception {
        get("/chat/conversations/999999/messages", userToken())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("越权:user2 读不到 user1 的会话消息(403)")
    void otherUserCannotReadMessages() throws Exception {
        int conversationId = createConversation(userToken(), 1, "private");
        get("/chat/conversations/" + conversationId + "/messages", user2Token())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("越权:user2 不能往 user1 的会话里插消息(403)")
    void otherUserCannotSendIntoConversation() throws Exception {
        int conversationId = createConversation(userToken(), 1, "mine");
        post("/chat/messages", user2Token(), Map.of(
                "conversationId", conversationId,
                "receiverId", 1,
                "content", "injected"
        )).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("越权:user2 不能标记 user1 的会话已读(403)")
    void otherUserCannotMarkRead() throws Exception {
        int conversationId = createConversation(userToken(), 1, "unread");
        put("/chat/conversations/" + conversationId + "/read", user2Token(), null)
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("店铺侧:该店铺能读自己的会话 —— 两套 id 空间的回归网")
    void shopParticipantCanReadItsOwnConversation() throws Exception {
        // user1 → shop2,故会话是 (user_id=1, shop_id=2)
        int conversationId = createConversation(userToken(), 2, "hello shop two");

        // shop2 是参与者
        get("/chat/conversations/" + conversationId + "/messages", shop2Token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].content").value("hello shop two"));

        // shop1 不是参与者;若实现误把 shop_id 与会话的 user_id(=1)比较,这里会错误放行
        get("/chat/conversations/" + conversationId + "/messages", shopToken())
                .andExpect(status().isForbidden());
    }

    /** 发一条消息建出会话,返回会话 id */
    private int createConversation(String token, int receiverShopId, String content) throws Exception {
        MvcResult result = post("/chat/messages", token, Map.of(
                "receiverId", receiverShopId,
                "content", content
        )).andExpect(status().isOk()).andReturn();
        JSONObject data = JSONObject.parseObject(
                        result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data");
        Integer conversationId = data.getInteger("conversationId");
        assertNotNull(conversationId, "发消息应回填 conversationId");
        return conversationId;
    }
}
