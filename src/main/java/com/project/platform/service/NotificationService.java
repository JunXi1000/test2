package com.project.platform.service;

import com.project.platform.entity.Notification;

import java.util.List;

/**
 * 系统通知服务
 */
public interface NotificationService {

    List<Notification> getForRole(Integer userId, String role);

    void markRead(Integer userId, Integer id);

    void markAllRead(Integer userId, String role);
}
