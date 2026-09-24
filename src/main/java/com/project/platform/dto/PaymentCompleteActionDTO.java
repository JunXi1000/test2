package com.project.platform.dto;

import lombok.Data;

/**
 * 支付完成回调(POST /payments/complete-action)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。与 {@link PaymentConfirmDTO} **回落顺序相反**:
 * 这里优先读 `paymentId`,为空则回落 `orderId` —— 既有实现如此,原样保留。
 */
@Data
public class PaymentCompleteActionDTO {
    private String paymentId;
    private String orderId;
}
