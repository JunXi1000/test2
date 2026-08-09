package com.project.platform.entity;

import java.time.LocalDateTime;

/**
 * 用户已领取的优惠券
 */
public class UserCoupon {
    /**
     * id
     */
    private Integer id;
    /**
     * 用户id
     */
    private Integer userId;
    /**
     * 优惠券id
     */
    private Integer couponId;
    /**
     * 状态:unused / used
     */
    private String status;
    /**
     * 领取时间
     */
    private LocalDateTime claimedTime;
    /**
     * 使用时间
     */
    private LocalDateTime usedTime;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public Integer getCouponId() {
        return couponId;
    }

    public void setCouponId(Integer couponId) {
        this.couponId = couponId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getClaimedTime() {
        return claimedTime;
    }

    public void setClaimedTime(LocalDateTime claimedTime) {
        this.claimedTime = claimedTime;
    }

    public LocalDateTime getUsedTime() {
        return usedTime;
    }

    public void setUsedTime(LocalDateTime usedTime) {
        this.usedTime = usedTime;
    }
}
