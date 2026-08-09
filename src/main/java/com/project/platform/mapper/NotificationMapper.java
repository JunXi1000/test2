package com.project.platform.mapper;

import com.project.platform.entity.Notification;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

public interface NotificationMapper {

    /**
     * 当前角色的通知:广播(user_id=0)或定向投递给本人
     */
    @Select("SELECT * FROM notification WHERE role = #{role} AND (user_id = 0 OR user_id = #{userId}) " +
            "ORDER BY id DESC")
    List<Notification> selectForRole(Integer userId, String role);

    @Update("UPDATE notification SET is_read = 1 WHERE id = #{id} AND (user_id = 0 OR user_id = #{userId})")
    int markRead(Integer userId, Integer id);

    @Update("UPDATE notification SET is_read = 1 WHERE role = #{role} AND (user_id = 0 OR user_id = #{userId})")
    int markAllRead(Integer userId, String role);
}
