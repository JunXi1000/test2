package com.project.platform.service;

/**
 * 支付服务(Phase 2 模拟网关)。
 * 真实落库改单,但不存在真实商户号与回调验签;接入微信/支付宝时需替换为
 * 「网关下单 + 回调验签 + 幂等入账」。
 */
public interface PaymentService {

    /**
     * 确认支付:校验支付单归属/状态后落库改单(幂等)。
     *
     * @param orderNo 订单分组号(即 paymentId)
     * @param channel 支付渠道,可空;空则取支付单记录的 channel
     */
    void confirm(String orderNo, String channel);

    /**
     * 3DS 认证完成后的支付确认:读支付单 channel 转调 {@link #confirm(String, String)}。
     */
    void complete(String orderNo);
}
