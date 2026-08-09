package com.project.platform.controller;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.Notification;
import com.project.platform.service.NotificationService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 系统通知 API — matches frontend's expected /notifications contract.
 */
@RestController
@RequestMapping("/notifications")
public class NotificationController {

    @Resource
    private NotificationService notificationService;

    @GetMapping("")
    public ResponseVO<List<Map<String, Object>>> getNotifications() {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Notification n : notificationService.getForRole(current.getId(), current.getType())) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", n.getId());
            m.put("title", n.getTitle());
            m.put("message", n.getContent());
            m.put("type", n.getType());
            m.put("read", Boolean.TRUE.equals(n.getIsRead()));
            m.put("createdAt", n.getCreateTime() == null ? null
                    : n.getCreateTime().toInstant(ZoneOffset.UTC).toEpochMilli());
            result.add(m);
        }
        return ResponseVO.ok(result);
    }

    @PostMapping("/{id}/read")
    public ResponseVO<?> markRead(@PathVariable Integer id) {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        notificationService.markRead(current.getId(), id);
        return ResponseVO.ok();
    }

    @PostMapping("/read-all")
    public ResponseVO<?> markAllRead() {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        notificationService.markAllRead(current.getId(), current.getType());
        return ResponseVO.ok();
    }
}
