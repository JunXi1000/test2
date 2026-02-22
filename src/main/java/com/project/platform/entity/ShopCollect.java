package com.project.platform.entity;

import java.time.LocalDateTime;

/**
 * 店铺收藏
 */
public class ShopCollect {
    /**
     * id
     */
    private Integer id;
    /**
     * 店铺
     */
    private Integer shopId;
    /**
     * 店铺名称
     */
    private String shopName;

    /**
     * 店铺头像
     */
    private String shopAvatar;
    /**
     * 用户
     */
    private Integer userId;
    /**
     * 用户名
     */
    private String userName;
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

    public Integer getShopId() {
        return shopId;
    }

    public void setShopId(Integer shopId) {
        this.shopId = shopId;
    }

    public String getShopName() {
        return shopName;
    }

    public void setShopName(String shopName) {
        this.shopName = shopName;
    }

    public String getShopAvatar() {
        return shopAvatar;
    }

    public void setShopAvatar(String shopAvatar) {
        this.shopAvatar = shopAvatar;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }


}
