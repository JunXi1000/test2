package com.project.platform.controller;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.UserNotificationPref;
import com.project.platform.service.UserNotificationPrefService;
import com.project.platform.service.UserService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Storefront account API — matches frontend's expected /account contract.
 */
@RestController
@RequestMapping("/account")
public class StorefrontAccountController {

    @Resource
    private UserService userService;

    @Resource
    private UserNotificationPrefService userNotificationPrefService;

    @GetMapping("/profile")
    public ResponseVO<Map<String, Object>> getProfile() {
        CurrentUserDTO u = CurrentUserThreadLocal.getCurrentUser();
        Map<String, Object> profile = new HashMap<>();
        profile.put("firstName", u.getNickname());
        profile.put("lastName", "");
        profile.put("email", u.getEmail());
        profile.put("phone", u.getTel());
        profile.put("avatar", u.getAvatarUrl());
        return ResponseVO.ok(profile);
    }

    @PostMapping("/profile")
    public ResponseVO<?> updateProfile(@RequestBody Map<String, Object> data) {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        if (data.containsKey("firstName") || data.containsKey("lastName")) {
            current.setNickname((String) data.getOrDefault("firstName", current.getNickname()));
        }
        if (data.containsKey("phone")) {
            current.setTel((String) data.get("phone"));
        }
        if (data.containsKey("avatar")) {
            current.setAvatarUrl((String) data.get("avatar"));
        }
        userService.updateCurrentUserInfo(current);
        return ResponseVO.ok();
    }

    @GetMapping("/notifications")
    public ResponseVO<Map<String, Object>> getNotificationPrefs() {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        UserNotificationPref pref = userNotificationPrefService.getByUserId(current.getId());
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("emailOrder", pref != null ? pref.getEmailOrder() : true);
        prefs.put("emailPromo", pref != null ? pref.getEmailPromo() : false);
        prefs.put("smsOrder", pref != null ? pref.getSmsOrder() : true);
        return ResponseVO.ok(prefs);
    }

    @PostMapping("/notifications")
    public ResponseVO<?> updateNotificationPrefs(@RequestBody Map<String, Object> data) {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        UserNotificationPref pref = new UserNotificationPref();
        pref.setUserId(current.getId());
        pref.setEmailOrder(toBool(data.get("emailOrder"), true));
        pref.setEmailPromo(toBool(data.get("emailPromo"), false));
        pref.setSmsOrder(toBool(data.get("smsOrder"), true));
        userNotificationPrefService.upsert(pref);
        return ResponseVO.ok();
    }

    private boolean toBool(Object value, boolean def) {
        if (value == null) {
            return def;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }
}
