package com.project.platform.service.impl;

import com.project.platform.entity.Notification;
import com.project.platform.mapper.NotificationMapper;
import com.project.platform.service.NotificationService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 系统通知服务
 */
@Service
public class NotificationServiceImpl implements NotificationService {

    @Resource
    private NotificationMapper notificationMapper;

    @Override
    public List<Notification> getForRole(Integer userId, String role) {
        return notificationMapper.selectForRole(userId, role);
    }

    @Override
    public void markRead(Integer userId, Integer id) {
        notificationMapper.markRead(userId, id);
    }

    @Override
    public void markAllRead(Integer userId, String role) {
        notificationMapper.markAllRead(userId, role);
    }
}
