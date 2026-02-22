package com.project.platform.entity;

import java.time.LocalDateTime;
/**
 * 订单评价
 */
public class ProductOrderEvaluate  {
   /**
    * id
    */
   private Integer id;
   /**
   * 用户
   */
   private Integer userId;
   /**
   * 用户名
   */
   private String username;
   /**
   * 用户头像
   */
   private String userAvatar;
   /**
   * 商品
   */
   private Integer productId;
   /**
   * 商品名称
   */
   private String productName;
   /**
   * 订单
   */
   private Integer productOrderId;
   /**
   * 内容
   */
   private String content;
   /**
   * 评分
   */
   private Integer rate;
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

   public String getUsername() {
      return username;
   }

   public void setUsername(String username) {
      this.username = username;
   }

   public String getUserAvatar() {
      return userAvatar;
   }

   public void setUserAvatar(String userAvatar) {
      this.userAvatar = userAvatar;
   }

   public Integer getProductId() {
      return productId;
   }

   public void setProductId(Integer productId) {
      this.productId = productId;
   }

   public String getProductName() {
      return productName;
   }

   public void setProductName(String productName) {
      this.productName = productName;
   }

   public Integer getProductOrderId() {
      return productOrderId;
   }

   public void setProductOrderId(Integer productOrderId) {
      this.productOrderId = productOrderId;
   }

   public String getContent() {
      return content;
   }

   public void setContent(String content) {
      this.content = content;
   }

   public Integer getRate() {
      return rate;
   }

   public void setRate(Integer rate) {
      this.rate = rate;
   }

   public LocalDateTime getCreateTime() {
      return createTime;
   }

   public void setCreateTime(LocalDateTime createTime) {
      this.createTime = createTime;
   }


}
