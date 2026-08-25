package com.project.platform.vo;

import java.math.BigDecimal;

/**
 * 结算下单结果(Phase 2)。
 * orderNo 即本次结算的分组号(同时充当支付单 id/paymentId);amount 为待支付金额。
 */
public class StorefrontCheckoutResult {
    private String orderNo;
    private BigDecimal amount;

    public StorefrontCheckoutResult() {
    }

    public StorefrontCheckoutResult(String orderNo, BigDecimal amount) {
        this.orderNo = orderNo;
        this.amount = amount;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
