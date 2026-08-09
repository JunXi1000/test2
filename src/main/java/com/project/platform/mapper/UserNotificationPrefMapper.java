package com.project.platform.mapper;

import com.project.platform.entity.UserNotificationPref;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface UserNotificationPrefMapper {

    @Select("SELECT * FROM user_notification_pref WHERE user_id = #{userId}")
    UserNotificationPref selectByUserId(Integer userId);

    @Insert("INSERT INTO user_notification_pref(user_id, email_order, email_promo, sms_order) " +
            "VALUES(#{userId}, #{emailOrder}, #{emailPromo}, #{smsOrder})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(UserNotificationPref entity);

    @Update("UPDATE user_notification_pref SET email_order=#{emailOrder}, email_promo=#{emailPromo}, " +
            "sms_order=#{smsOrder} WHERE id=#{id}")
    int updateById(UserNotificationPref entity);
}
