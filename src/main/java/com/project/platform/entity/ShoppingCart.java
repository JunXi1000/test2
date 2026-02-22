package com.project.platform.entity;

import java.time.LocalDateTime;
/**
 * 购物车
 */
public class ShoppingCart  {
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
   * 数量
   */
   private Integer quantity;
   /**
   * 创建时间
   */
   private LocalDateTime createTime;

   /**
    * 商品封面图
    */
   private String productMainImg;

   /**
    * 价格
    */
   private Float productPrice;

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

   public Integer getQuantity() {
      return quantity;
   }

   public void setQuantity(Integer quantity) {
      this.quantity = quantity;
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

   public Float getProductPrice() {
      return productPrice;
   }

   public void setProductPrice(Float productPrice) {
      this.productPrice = productPrice;
   }
}
