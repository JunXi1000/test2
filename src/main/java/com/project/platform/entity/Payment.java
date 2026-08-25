package com.project.platform.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 支付单(Phase 2 模拟网关)。
 * 一次结算(同一 order_no)对应一张支付单;status: 待支付 -> 已支付 / 已取消 / 已超时。
 */
public class Payment {
    /**
     * id
     */
    private Integer id;
    /**
     * 订单分组号(与 product_order.order_no 对应)
     */
    private String orderNo;
    /**
     * 用户
     */
    private Integer userId;
    /**
     * 支付金额
     */
    private BigDecimal amount;
    /**
     * 支付渠道(balance=钱包余额 / card=模拟银行卡)
     */
    private String channel;
    /**
     * 交易流水号(模拟网关)
     */
    private String transactionNo;
    /**
     * 状态
     */
    private String status;
    /**
     * 支付时间
     */
    private LocalDateTime paidTime;
    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public String getTransactionNo() {
        return transactionNo;
    }

    public void setTransactionNo(String transactionNo) {
        this.transactionNo = transactionNo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getPaidTime() {
        return paidTime;
    }

    public void setPaidTime(LocalDateTime paidTime) {
        this.paidTime = paidTime;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }
}
