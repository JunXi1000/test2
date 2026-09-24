package com.project.platform.dto;

import lombok.Data;

/**
 * 更新通知偏好(POST /account/notifications)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。三个字段都可为 null,由控制器按既有默认值
 * (emailOrder=true / emailPromo=false / smsOrder=true)兜底 —— 行为与既有实现一致。
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
