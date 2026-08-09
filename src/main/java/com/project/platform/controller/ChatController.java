package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.Conversation;
import com.project.platform.entity.Message;
import com.project.platform.service.ChatService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Chat / messaging between customers (USER) and merchants (SHOP)
 */
@RestController
@RequestMapping("/chat")
public class ChatController {

    @Resource
    private ChatService chatService;

    /**
     * List conversations for the current user
     */
    @GetMapping("/conversations")
    public ResponseVO<List<Conversation>> getConversations() {
        CurrentUserDTO currentUser = CurrentUserThreadLocal.getCurrentUser();
        List<Conversation> list = chatService.getConversations(
                currentUser.getId(), currentUser.getType());
        return ResponseVO.ok(list);
    }

    /**
     * Get messages in a conversation
     */
    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseVO<List<Message>> getMessages(@PathVariable Integer conversationId) {
        List<Message> messages = chatService.getMessages(conversationId);
        return ResponseVO.ok(messages);
    }

    /**
     * Send a message.
     * Body: { conversationId?, receiverId, content, productId?, isMerchant }
     */
    @PostMapping("/messages")
    public ResponseVO<Message> sendMessage(@RequestBody JSONObject body) {
        CurrentUserDTO currentUser = CurrentUserThreadLocal.getCurrentUser();
        boolean isMerchant = body.getBooleanValue("isMerchant");

        String senderType = isMerchant ? "SHOP" : "USER";
        Integer senderId = currentUser.getId();
        Integer receiverId = body.getInteger("receiverId");
        String content = body.getString("content");
        Integer conversationId = body.getInteger("conversationId");
        Integer productId = body.getInteger("productId");

        Message message = chatService.sendMessage(
                senderId, senderType, receiverId, content, conversationId, productId);
        return ResponseVO.ok(message);
    }

    /**
     * Mark all messages in a conversation as read
     */
    @PutMapping("/conversations/{conversationId}/read")
    public ResponseVO<?> markAsRead(@PathVariable Integer conversationId) {
        CurrentUserDTO currentUser = CurrentUserThreadLocal.getCurrentUser();
        String readerType = "SHOP".equals(currentUser.getType()) ? "SHOP" : "USER";
        chatService.markAsRead(conversationId, readerType);
        return ResponseVO.ok();
    }
}
