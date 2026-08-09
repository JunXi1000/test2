package com.project.platform.mapper;

import com.project.platform.entity.Conversation;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

public interface ConversationMapper {

    @Select("SELECT * FROM conversation WHERE user_id = #{userId} AND shop_id = #{shopId}")
    Conversation selectByUserAndShop(@Param("userId") Integer userId, @Param("shopId") Integer shopId);

    @Select("SELECT c.*, s.name AS shopName, s.avatar_url AS shopAvatar " +
            "FROM conversation c " +
            "LEFT JOIN shop s ON c.shop_id = s.id " +
            "WHERE c.user_id = #{userId} " +
            "ORDER BY c.last_message_time DESC")
    List<Conversation> selectByUser(@Param("userId") Integer userId);

    @Select("SELECT c.*, u.nickname AS userName, u.avatar_url AS userAvatar " +
            "FROM conversation c " +
            "LEFT JOIN user u ON c.user_id = u.id " +
            "WHERE c.shop_id = #{shopId} " +
            "ORDER BY c.last_message_time DESC")
    List<Conversation> selectByShop(@Param("shopId") Integer shopId);

    @Select("SELECT * FROM conversation WHERE id = #{id}")
    Conversation selectById(Integer id);

    int insert(Conversation entity);

    int updateLastMessage(@Param("id") Integer id,
                          @Param("lastMessage") String lastMessage,
                          @Param("lastMessageTime") LocalDateTime lastMessageTime);

    int incrementUnread(@Param("conversationId") Integer conversationId,
                        @Param("column") String column);

    int resetUnread(@Param("conversationId") Integer conversationId,
                    @Param("column") String column);
}
