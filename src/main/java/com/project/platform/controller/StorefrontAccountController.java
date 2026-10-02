package com.project.platform.controller;

import com.project.platform.dto.AccountProfileDTO;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.NotificationPrefsDTO;
import com.project.platform.entity.UserNotificationPref;
import com.project.platform.exception.CustomException;
import com.project.platform.service.UserNotificationPrefService;
import com.project.platform.service.UserService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
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

    /**
     * POST /account/notifications — 更新通知偏好(upsert)。
     *
     * <p><b>C6 契约(2026-10-02):三个偏好全缺 → 400。</b>
     *
     * <p>此前三个字段的 {@code null} 一律被当成「未传」并按默认值
     * ({@code emailOrder=true} / {@code emailPromo=false} / {@code smsOrder=true})兜底 ——
     * 于是<b>空 body、甚至完全错字段名的 body({@code {email,push,sms}},那是商家端形状)
     * 都会返回 200 并静默写下一行默认值</b>。用户以为偏好保存了,实际存的是默认值,
     * 属又一处「静默 200 假成功」。
     *
     * <p><b>MAJ-E3 修复(2026-10-02):load-then-merge,不再用「默认值」覆盖未提交的字段。</b>
     * C6 的第一版实现是「新建实体 + 未传字段填默认值」,而
     * {@code UserNotificationPrefMapper.updateById} 的 UPDATE 会写全部三列 ⇒
     * <b>用户只改一个开关,另外两项被静默重置为默认值</b>(数据正确性问题)。
     * 现在的口径:先按 userId 读现有行,未在请求中出现的字段<b>保留库里的现值</b>;
     * 只有该用户**尚无任何记录**时,未传字段才落到默认值(与
     * {@code GET /account/notifications} 在无记录时返回的默认值一致)。
     *
     * <p>因此「部分提交」的语义是 <b>patch 而不是整行替换</b>:
     * 全量提交(前端 {@code pages/dashboard/Settings.vue} 的整块提交)与
     * 「只改一个开关」(契约 C6 明确要保住)两种用法都成立。
     *
     * <p><b>字段名就是</b> {@code emailOrder / emailPromo / smsOrder},与响应、
     * {@code user_notification_pref} 的三列一一对应 —— 买家侧前后端本来就一致,无需对齐。
     * {@code {email,push,sms}} 属商家端 {@code PUT /merchant/settings}(已按 C5 降级为 501)。
     */
    @PostMapping("/notifications")
    public ResponseVO<?> updateNotificationPrefs(@RequestBody NotificationPrefsDTO data) {
        if (data.getEmailOrder() == null && data.getEmailPromo() == null && data.getSmsOrder() == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST,
                    "通知偏好不能全为空:请至少提交 emailOrder / emailPromo / smsOrder 中的一个");
        }
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        UserNotificationPref pref = new UserNotificationPref();
        pref.setUserId(current.getId());
        // load-then-merge:未传的字段保留库里的现值,而不是回落默认值。
        // 三处兜底默认值只在「该用户还没有任何记录」时生效(与 GET 的默认值一致)。
        UserNotificationPref existing = userNotificationPrefService.getByUserId(current.getId());
        pref.setEmailOrder(data.getEmailOrder() != null ? data.getEmailOrder()
                : existing != null ? existing.getEmailOrder() : true);
        pref.setEmailPromo(data.getEmailPromo() != null ? data.getEmailPromo()
                : existing != null ? existing.getEmailPromo() : false);
        pref.setSmsOrder(data.getSmsOrder() != null ? data.getSmsOrder()
                : existing != null ? existing.getSmsOrder() : true);
        userNotificationPrefService.upsert(pref);
        return ResponseVO.ok();
    }
}
