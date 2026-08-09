package com.project.platform.entity;

import java.time.LocalDateTime;

/**
 * 用户通知偏好
 */
public class UserNotificationPref {
    /**
     * id
     */
    private Integer id;
    /**
     * 用户id
     */
    private Integer userId;
    /**
     * 订单邮件通知
     */
    private Boolean emailOrder;
    /**
     * 促销邮件通知
     */
    private Boolean emailPromo;
    /**
     * 短信通知
     */
    private Boolean smsOrder;
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

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public Boolean getEmailOrder() {
        return emailOrder;
    }

    public void setEmailOrder(Boolean emailOrder) {
        this.emailOrder = emailOrder;
    }

    public Boolean getEmailPromo() {
        return emailPromo;
    }

    public void setEmailPromo(Boolean emailPromo) {
        this.emailPromo = emailPromo;
    }

    public Boolean getSmsOrder() {
        return smsOrder;
    }

    public void setSmsOrder(Boolean smsOrder) {
        this.smsOrder = smsOrder;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }
}
