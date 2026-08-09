package com.project.platform.service;

import com.project.platform.entity.Conversation;
import com.project.platform.entity.Message;

import java.util.List;

public interface ChatService {

    /**
     * Get all conversations for the current user.
     * @param currentUserId the authenticated user/shop ID
     * @param currentUserType "USER" or "SHOP"
     */
    List<Conversation> getConversations(Integer currentUserId, String currentUserType);

    /**
     * Get all messages in a conversation, ordered chronologically.
     */
    List<Message> getMessages(Integer conversationId);

    /**
     * Send a message. Creates the conversation automatically if it doesn't exist.
     *
     * @param senderId       sender ID
     * @param senderType     "USER" or "SHOP"
     * @param receiverId     receiver ID (shop ID if sender is USER, user ID if sender is SHOP)
     * @param content        message text
     * @param conversationId optional — if null, a conversation is found or created
     * @param productId      optional product context
     * @return the newly created Message
     */
    Message sendMessage(Integer senderId, String senderType, Integer receiverId,
                        String content, Integer conversationId, Integer productId);

    /**
     * Mark all messages in a conversation as read for the given reader type,
     * and reset the unread counter.
     */
    void markAsRead(Integer conversationId, String readerType);
}
