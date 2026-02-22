package com.project.platform.entity;

import java.time.LocalDateTime;
/**
 * 商品浏览历史
 */
public class ProductBrowsingHistory  {
   /**
    * id
    */
   private Integer id;
   /**
   * 商品
   */
   private Integer productId;
   /**
   * 商品名称
   */
   private String productName;
   /**
   * 用户
   */
   private Integer userId;
   /**
   * 用户名
   */
   private String username;
   /**
   * 创建时间
   */
   private LocalDateTime createTime;
   /**
    * 商品封面图
    */
   private String productMainImg;

   public Integer getId() {
      return id;
   }

   public void setId(Integer id) {
      this.id = id;
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

   public LocalDateTime getCreateTime() {
      return createTime;
   }

   public void setCreateTime(LocalDateTime createTime) {
      this.createTime = createTime;
   }

   public String getProductMainImg() {
      return productMainImg;
   }

   public void setProductMainImg(String productMainImg) {
      this.productMainImg = productMainImg;
   }
}
