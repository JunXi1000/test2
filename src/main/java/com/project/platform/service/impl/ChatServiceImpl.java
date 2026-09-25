package com.project.platform.service.impl;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.Conversation;
import com.project.platform.entity.Message;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ConversationMapper;
import com.project.platform.mapper.MessageMapper;
import com.project.platform.service.ChatService;
import com.project.platform.utils.AccessGuard;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        loadOwnedConversation(conversationId);
        return messageMapper.selectByConversation(conversationId);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public Message sendMessage(Integer senderId, String senderType, Integer receiverId,
                               String content, Integer conversationId, Integer productId) {
        // Find or create conversation
        Conversation conversation = null;
        Integer userId, shopId;

        if (conversationId != null) {
            conversation = conversationMapper.selectById(conversationId);
            if (conversation != null) {
                // 归属校验:不能往别人的会话里插消息。
                // 会话不存在时保持原行为(落到下面按 user+shop 查找/新建),只有「别人的会话」才拒绝。
                checkParticipant(conversation);
            }
        }

        if (conversation == null) {
            // receiverId 只在**需要新建/查找会话**时才是必需的:若上面已按 conversationId 取到会话,
            // 它在整个方法里都不被使用,无条件要求它会破坏"往已有会话发消息"这一现在可用且前端在用的调用。
            // 缺它时下游会把 null 当 userId/shopId 去 insert,撞 conversation 的 NOT NULL → 500。
            if (receiverId == null) {
                throw new CustomException(HttpStatus.BAD_REQUEST, "缺少接收方:新会话必须提供 receiverId");
            }
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

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void markAsRead(Integer conversationId, String readerType) {
        loadOwnedConversation(conversationId);
        messageMapper.markAsRead(conversationId, readerType);
        // Reset unread counter for the reader
        if ("SHOP".equals(readerType)) {
            conversationMapper.resetUnread(conversationId, "shop_unread_count");
        } else {
            conversationMapper.resetUnread(conversationId, "user_unread_count");
        }
    }

    /**
     * 按会话 id 取会话并校验当前用户是参与者;不存在则 404。
     */
    private Conversation loadOwnedConversation(Integer conversationId) {
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new CustomException(HttpStatus.NOT_FOUND, "会话不存在");
        }
        checkParticipant(conversation);
        return conversation;
    }

    /**
     * 校验当前用户是该会话的参与者(买卖双方之一)。
     *
     * <p><b>关键</b>:{@code user} 与 {@code shop} 是**两套独立 id 空间**(两边都有 id=1),所以
     * 必须按角色选要比较的列 —— SHOP 比 {@code shop_id},其余比 {@code user_id}。若混用,
     * 「买家 1」会被误判为「店铺 1」的会话。
     */
    private void checkParticipant(Conversation conversation) {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        Integer ownerId = "SHOP".equals(current.getType())
                ? conversation.getShopId()
                : conversation.getUserId();
        AccessGuard.checkOwner(ownerId, current, "会话");
    }
}
