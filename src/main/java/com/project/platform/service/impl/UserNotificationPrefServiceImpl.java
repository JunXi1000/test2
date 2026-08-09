package com.project.platform.service.impl;

import com.project.platform.entity.UserNotificationPref;
import com.project.platform.mapper.UserNotificationPrefMapper;
import com.project.platform.service.UserNotificationPrefService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

/**
 * 用户通知偏好
 */
@Service
public class UserNotificationPrefServiceImpl implements UserNotificationPrefService {

    @Resource
    private UserNotificationPrefMapper userNotificationPrefMapper;

    @Override
    public UserNotificationPref getByUserId(Integer userId) {
        return userNotificationPrefMapper.selectByUserId(userId);
    }

    @Override
    public void upsert(UserNotificationPref pref) {
        UserNotificationPref existing = userNotificationPrefMapper.selectByUserId(pref.getUserId());
        if (existing == null) {
            userNotificationPrefMapper.insert(pref);
        } else {
            pref.setId(existing.getId());
            userNotificationPrefMapper.updateById(pref);
        }
    }
}
