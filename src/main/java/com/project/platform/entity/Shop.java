package com.project.platform.entity;

import java.time.LocalDateTime;

/**
 * 店铺
 */
public class Shop {
    /**
     * id
     */
    private Integer id;
    /**
     * 用户名
     */
    private String username;
    /**
     * 密码
     */
    private String password;
    /**
     * 昵称
     */
    private String nickname;
    /**
     * 头像
     */
    private String avatarUrl;
    /**
     * 电话
     */
    private String tel;
    /**
     * 邮箱
     */
    private String email;
    /**
     * 状态
     */
    private String status;
    /**
     * 名称
     */
    private String name;
    /**
     * 粉丝数量
     */
    private Integer fansCount;
    /**
     * 资质
     */
    private String aptitudeImgs;
    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 店铺收藏ID
     */
    private Integer shopCollectId;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getTel() {
        return tel;
    }

    public void setTel(String tel) {
        this.tel = tel;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getFansCount() {
        return fansCount;
    }

    public void setFansCount(Integer fansCount) {
        this.fansCount = fansCount;
    }

    public String getAptitudeImgs() {
        return aptitudeImgs;
    }

    public void setAptitudeImgs(String aptitudeImgs) {
        this.aptitudeImgs = aptitudeImgs;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }


    public Integer getShopCollectId() {
        return shopCollectId;
    }

    public void setShopCollectId(Integer shopCollectId) {
        this.shopCollectId = shopCollectId;
    }
}
