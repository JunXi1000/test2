package com.project.platform.entity;

import java.time.LocalDateTime;
/**
 * 商品订单
 */
public class ProductOrder  {
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
    * 店铺
    */
   private Integer shopId;
   /**
    * 店铺名称
    */
   private String shopName;
   /**
    * 总金额
    */
   private Float totalMoney;
   /**
    * 数量
    */
   private Integer quantity;
   /**
    * 用户
    */
   private Integer userId;
   /**
    * 用户名
    */
   private String username;
   /**
    * 状态
    */
   private String status;
   /**
    * 收货人姓名
    */
   private String consigneeName;
   /**
    * 收货人电话
    */
   private String consigneeTel;
   /**
    * 收货人地址
    */
   private String consigneeAddress;
   /**
    * 物流单号
    */
   private String trackingNumber;
   /**
    * 备注
    */
   private String remark;
   /**
    * 评价Id
    */
   private Integer orderEvaluateId;
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

   public Float getTotalMoney() {
      return totalMoney;
   }

   public void setTotalMoney(Float totalMoney) {
      this.totalMoney = totalMoney;
   }

   public Integer getQuantity() {
      return quantity;
   }

   public void setQuantity(Integer quantity) {
      this.quantity = quantity;
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

   public String getStatus() {
      return status;
   }

   public void setStatus(String status) {
      this.status = status;
   }

   public String getConsigneeName() {
      return consigneeName;
   }

   public void setConsigneeName(String consigneeName) {
      this.consigneeName = consigneeName;
   }

   public String getConsigneeTel() {
      return consigneeTel;
   }

   public void setConsigneeTel(String consigneeTel) {
      this.consigneeTel = consigneeTel;
   }

   public String getConsigneeAddress() {
      return consigneeAddress;
   }

   public void setConsigneeAddress(String consigneeAddress) {
      this.consigneeAddress = consigneeAddress;
   }

   public String getTrackingNumber() {
      return trackingNumber;
   }

   public void setTrackingNumber(String trackingNumber) {
      this.trackingNumber = trackingNumber;
   }

   public String getRemark() {
      return remark;
   }

   public void setRemark(String remark) {
      this.remark = remark;
   }

   public Integer getOrderEvaluateId() {
      return orderEvaluateId;
   }

   public void setOrderEvaluateId(Integer orderEvaluateId) {
      this.orderEvaluateId = orderEvaluateId;
   }

   public LocalDateTime getCreateTime() {
      return createTime;
   }

   public void setCreateTime(LocalDateTime createTime) {
      this.createTime = createTime;
   }


}
