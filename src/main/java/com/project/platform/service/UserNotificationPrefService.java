package com.project.platform.service;

import com.project.platform.entity.UserNotificationPref;

/**
 * 用户通知偏好
 */
public interface UserNotificationPrefService {

    UserNotificationPref getByUserId(Integer userId);

    void upsert(UserNotificationPref pref);
}
