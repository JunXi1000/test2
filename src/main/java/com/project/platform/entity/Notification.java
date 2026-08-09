package com.project.platform.entity;

import java.time.LocalDateTime;

/**
 * 系统通知(按角色广播或定向投递)
 */
public class Notification {
    /**
     * id
     */
    private Integer id;
    /**
     * 目标用户id,0 表示广播给该角色全部用户
     */
    private Integer userId;
    /**
     * 目标角色:ADMIN / SHOP / USER
     */
    private String role;
    /**
     * 标题
     */
    private String title;
    /**
     * 内容
     */
    private String content;
    /**
     * 类型:info / success / warning / error
     */
    private String type;
    /**
     * 是否已读
     */
    private Boolean isRead;
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

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Boolean getIsRead() {
        return isRead;
    }

    public void setIsRead(Boolean isRead) {
        this.isRead = isRead;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }
}
