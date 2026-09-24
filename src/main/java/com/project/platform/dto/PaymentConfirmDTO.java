package com.project.platform.dto;

import lombok.Data;

/**
 * 确认支付(POST /payments/confirm)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。既有实现**优先读 `orderId`,为空则回落
 * `paymentId`**(前端以 paymentId 携带 orderNo),这一回落顺序原样保留在控制器里。
 *
 * <p>{@code channel} 缺省时由下游读支付单记录的渠道 —— 与既有实现一致。
 */
@Data
public class PaymentConfirmDTO {
    private String orderId;
    /** 前端实际用这个字段携带 orderNo */
    private String paymentId;
    /** card / balance;缺省读支付单记录 */
    private String channel;
}
