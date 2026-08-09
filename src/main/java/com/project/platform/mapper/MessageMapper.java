package com.project.platform.mapper;

import com.project.platform.entity.Message;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MessageMapper {

    @Select("SELECT * FROM message WHERE conversation_id = #{conversationId} ORDER BY create_time ASC")
    List<Message> selectByConversation(@Param("conversationId") Integer conversationId);

    int insert(Message entity);

    int markAsRead(@Param("conversationId") Integer conversationId,
                   @Param("readerType") String readerType);
}
