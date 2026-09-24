package com.project.platform.controller;

import com.project.platform.dto.AccountProfileDTO;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.NotificationPrefsDTO;
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
    public ResponseVO<?> updateProfile(@RequestBody AccountProfileDTO data) {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        // 既有实现用 containsKey 判断「是否要更新」,故显式传 null 会把字段置空;
        // 换成 DTO 后 null 与「未传」不可区分,一律视为不更新。前端每次发送完整对象,
        // 该差异在实践中不可观测(详见 AccountProfileDTO 的类注释)。
        if (data.getFirstName() != null || data.getLastName() != null) {
            current.setNickname(data.getFirstName() != null ? data.getFirstName() : current.getNickname());
        }
        if (data.getPhone() != null) {
            current.setTel(data.getPhone());
        }
        if (data.getAvatar() != null) {
            current.setAvatarUrl(data.getAvatar());
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
    public ResponseVO<?> updateNotificationPrefs(@RequestBody NotificationPrefsDTO data) {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        UserNotificationPref pref = new UserNotificationPref();
        pref.setUserId(current.getId());
        // null 视为未传,按既有默认值兜底(与原 toBool(v, default) 对 null 的处理一致)
        pref.setEmailOrder(data.getEmailOrder() != null ? data.getEmailOrder() : true);
        pref.setEmailPromo(data.getEmailPromo() != null ? data.getEmailPromo() : false);
        pref.setSmsOrder(data.getSmsOrder() != null ? data.getSmsOrder() : true);
        userNotificationPrefService.upsert(pref);
        return ResponseVO.ok();
    }
}
