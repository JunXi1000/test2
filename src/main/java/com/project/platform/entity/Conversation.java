package com.project.platform.entity;

import java.time.LocalDateTime;

/**
 * Chat conversation between a customer (USER) and a merchant (SHOP)
 */
public class Conversation {
    private Integer id;
    private Integer userId;
    private Integer shopId;
    private Integer productId;
    private String lastMessage;
    private LocalDateTime lastMessageTime;
    private Integer userUnreadCount;
    private Integer shopUnreadCount;
    private LocalDateTime createTime;

    // Transient display fields (populated via JOIN)
    private String userName;
    private String userAvatar;
    private String shopName;
    private String shopAvatar;
    private String productName;
    private String productImage;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }

    public Integer getShopId() { return shopId; }
    public void setShopId(Integer shopId) { this.shopId = shopId; }

    public Integer getProductId() { return productId; }
    public void setProductId(Integer productId) { this.productId = productId; }

    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }

    public LocalDateTime getLastMessageTime() { return lastMessageTime; }
    public void setLastMessageTime(LocalDateTime lastMessageTime) { this.lastMessageTime = lastMessageTime; }

    public Integer getUserUnreadCount() { return userUnreadCount; }
    public void setUserUnreadCount(Integer userUnreadCount) { this.userUnreadCount = userUnreadCount; }

    public Integer getShopUnreadCount() { return shopUnreadCount; }
    public void setShopUnreadCount(Integer shopUnreadCount) { this.shopUnreadCount = shopUnreadCount; }

    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserAvatar() { return userAvatar; }
    public void setUserAvatar(String userAvatar) { this.userAvatar = userAvatar; }

    public String getShopName() { return shopName; }
    public void setShopName(String shopName) { this.shopName = shopName; }

    public String getShopAvatar() { return shopAvatar; }
    public void setShopAvatar(String shopAvatar) { this.shopAvatar = shopAvatar; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getProductImage() { return productImage; }
    public void setProductImage(String productImage) { this.productImage = productImage; }
}
