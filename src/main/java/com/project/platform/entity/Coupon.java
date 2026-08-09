package com.project.platform.entity;

import java.time.LocalDateTime;

/**
 * 优惠券(平台统一券池)
 */
public class Coupon {
    /**
     * id
     */
    private Integer id;
    /**
     * 优惠码
     */
    private String code;
    /**
     * 标题
     */
    private String title;
    /**
     * 描述
     */
    private String description;
    /**
     * 类型:percent / fixed / shipping
     */
    private String type;
    /**
     * 折扣值(百分比或固定金额)
     */
    private Double value;
    /**
     * 最低消费门槛
     */
    private Double minOrder;
    /**
     * 最大优惠金额(percent 类型)
     */
    private Double maxDiscount;
    /**
     * 适用品类(可选)
     */
    private String category;
    /**
     * 有效期
     */
    private LocalDateTime expiresAt;
    /**
     * 发行总量
     */
    private Integer total;
    /**
     * 已领取数量
     */
    private Integer claimed;
    /**
     * 状态:enabled / disabled
     */
    private String status;
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

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Double getValue() {
        return value;
    }

    public void setValue(Double value) {
        this.value = value;
    }

    public Double getMinOrder() {
        return minOrder;
    }

    public void setMinOrder(Double minOrder) {
        this.minOrder = minOrder;
    }

    public Double getMaxDiscount() {
        return maxDiscount;
    }

    public void setMaxDiscount(Double maxDiscount) {
        this.maxDiscount = maxDiscount;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Integer getTotal() {
        return total;
    }

    public void setTotal(Integer total) {
        this.total = total;
    }

    public Integer getClaimed() {
        return claimed;
    }

    public void setClaimed(Integer claimed) {
        this.claimed = claimed;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }
}
