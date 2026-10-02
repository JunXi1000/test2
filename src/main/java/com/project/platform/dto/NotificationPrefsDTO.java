package com.project.platform.dto;

import lombok.Data;

/**
 * 更新通知偏好(POST /account/notifications)的入参。
 *
 * <p><b>字段名就是</b> {@code emailOrder} / {@code emailPromo} / {@code smsOrder} ——
 * 与响应、与 DB {@code user_notification_pref(email_order/email_promo/sms_order)}
 * 一一对应,买家侧前后端本来就一致。{@code {email,push,sms}} 是**商家端**
 * {@code PUT /merchant/settings} 的形状,与本 DTO 无关(该端点已按 C5 降级为 501)。
 *
 * <p><b>C6 校验(2026-10-02 新增)</b>:三个偏好<b>全缺 → 400</b>
 * (见 {@code StorefrontAccountController#updateNotificationPrefs})。此前全缺会被当成
 * 「三个都是未传」并按默认值兜底,于是空 body / 错字段名都返回 200 且静默写入默认值。
 *
 * <p><b>部分提交是 patch,不是整行替换(MAJ-E3,2026-10-02)</b>:未在请求中出现的字段
 * <b>保留 {@code user_notification_pref} 里的现值</b>;只有该用户尚无记录时,未传字段
 * 才落到默认值({@code emailOrder=true} / {@code emailPromo=false} / {@code smsOrder=true})。
 * 此前「未传即填默认值」会让「只改一个开关」静默重置另外两项 —— 那是数据正确性缺陷,
 * 不是契约。因此本 DTO 的 {@code null} 语义是「该字段不参与本次 patch」。
 *
 * <p>⚠️ 一处**行为差异**:既有实现的 {@code toBool} 用 {@code Boolean.parseBoolean(String.valueOf(v))},
 * 传数字 {@code 1} 会得到 **false**;换成 {@code Boolean} 字段后由反序列化器处理,
 * {@code 1} 会得到 **true**。前端 `account.ts` 发的是真正的布尔值,故此差异在实践中不可观测,
 * 且新行为更符合直觉。**若将来确需兼容数字入参,应显式约定而不是依赖 parseBoolean 的副作用。**
 */
@Data
public class NotificationPrefsDTO {
    private Boolean emailOrder;
    private Boolean emailPromo;
    private Boolean smsOrder;
}
