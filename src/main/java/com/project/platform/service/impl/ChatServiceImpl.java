package com.project.platform.service.impl;

import com.project.platform.entity.Conversation;
import com.project.platform.entity.Message;
import com.project.platform.mapper.ConversationMapper;
import com.project.platform.mapper.MessageMapper;
import com.project.platform.service.ChatService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ChatServiceImpl implements ChatService {

    @Resource
    private ConversationMapper conversationMapper;

    @Resource
    private MessageMapper messageMapper;

    @Override
    public List<Conversation> getConversations(Integer currentUserId, String currentUserType) {
        if ("SHOP".equals(currentUserType)) {
            return conversationMapper.selectByShop(currentUserId);
        } else {
            return conversationMapper.selectByUser(currentUserId);
        }
    }

    @Override
    public List<Message> getMessages(Integer conversationId) {
        return messageMapper.selectByConversation(conversationId);
    }

    @Override
    public Message sendMessage(Integer senderId, String senderType, Integer receiverId,
                               String content, Integer conversationId, Integer productId) {
        // Find or create conversation
        Conversation conversation = null;
        Integer userId, shopId;

        if (conversationId != null) {
            conversation = conversationMapper.selectById(conversationId);
        }

        if (conversation == null) {
            // Determine user_id and shop_id from senderType
            if ("SHOP".equals(senderType)) {
                userId = receiverId;
                shopId = senderId;
            } else {
                userId = senderId;
                shopId = receiverId;
            }
            // Try to find existing conversation
            conversation = conversationMapper.selectByUserAndShop(userId, shopId);
            if (conversation == null) {
                conversation = new Conversation();
                conversation.setUserId(userId);
                conversation.setShopId(shopId);
                conversation.setProductId(productId);
                conversation.setUserUnreadCount(0);
                conversation.setShopUnreadCount(0);
                conversation.setCreateTime(LocalDateTime.now());
                conversationMapper.insert(conversation);
            }
        }

        // Create message
        Message message = new Message();
        message.setConversationId(conversation.getId());
        message.setSenderId(senderId);
        message.setSenderType(senderType);
        message.setContent(content);
        message.setType("text");
        message.setIsRead(false);
        message.setCreateTime(LocalDateTime.now());
        messageMapper.insert(message);

        // Update conversation preview
        String preview = content;
        if (preview != null && preview.length() > 200) {
            preview = preview.substring(0, 200) + "...";
        }
        conversationMapper.updateLastMessage(conversation.getId(), preview, message.getCreateTime());

        // Increment unread for the receiver
        if ("SHOP".equals(senderType)) {
            conversationMapper.incrementUnread(conversation.getId(), "user_unread_count");
        } else {
            conversationMapper.incrementUnread(conversation.getId(), "shop_unread_count");
        }

        return message;
    }

    @Override
    public void markAsRead(Integer conversationId, String readerType) {
        messageMapper.markAsRead(conversationId, readerType);
        // Reset unread counter for the reader
        if ("SHOP".equals(readerType)) {
            conversationMapper.resetUnread(conversationId, "shop_unread_count");
        } else {
            conversationMapper.resetUnread(conversationId, "user_unread_count");
        }
    }
}
