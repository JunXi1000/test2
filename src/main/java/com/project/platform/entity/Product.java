package com.project.platform.entity;

import java.time.LocalDateTime;
/**
 * 商品信息
 */
public class Product  {
   /**
    * id
    */
   private Integer id;
   /**
   * 名称
   */
   private String name;
   /**
   * 封面图
   */
   private String mainImg;
   /**
   * 详细图片
   */
   private String imgList;
   /**
   * 分类
   */
   private Integer productTypeId;
   /**
   * 分类名称
   */
   private String productTypeName;
   /**
   * 价格
   */
   private Float price;
   /**
   * 库存
   */
   private Integer stock;
   /**
   * 销量
   */
   private Integer salesVolume;
   /**
   * 简介
   */
   private String intro;
   /**
   * 商家
   */
   private Integer shopId;
   /**
   * 商家名称
   */
   private String shopName;
   /**
   * 创建时间
   */
   private LocalDateTime createTime;

   /**
    * 收藏id
    */
   private Integer productCollectId;

   /**
    * 推荐值
    */
   private int weight;

   public Integer getId() {
      return id;
   }

   public void setId(Integer id) {
      this.id = id;
   }
   public String getName() {
      return name;
   }

   public void setName(String name) {
      this.name = name;
   }

   public String getMainImg() {
      return mainImg;
   }

   public void setMainImg(String mainImg) {
      this.mainImg = mainImg;
   }

   public String getImgList() {
      return imgList;
   }

   public void setImgList(String imgList) {
      this.imgList = imgList;
   }

   public Integer getProductTypeId() {
      return productTypeId;
   }

   public void setProductTypeId(Integer productTypeId) {
      this.productTypeId = productTypeId;
   }

   public String getProductTypeName() {
      return productTypeName;
   }

   public void setProductTypeName(String productTypeName) {
      this.productTypeName = productTypeName;
   }

   public Float getPrice() {
      return price;
   }

   public void setPrice(Float price) {
      this.price = price;
   }

   public Integer getStock() {
      return stock;
   }

   public void setStock(Integer stock) {
      this.stock = stock;
   }

   public Integer getSalesVolume() {
      return salesVolume;
   }

   public void setSalesVolume(Integer salesVolume) {
      this.salesVolume = salesVolume;
   }

   public String getIntro() {
      return intro;
   }

   public void setIntro(String intro) {
      this.intro = intro;
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

   public LocalDateTime getCreateTime() {
      return createTime;
   }

   public void setCreateTime(LocalDateTime createTime) {
      this.createTime = createTime;
   }

   public Integer getProductCollectId() {
      return productCollectId;
   }

   public void setProductCollectId(Integer productCollectId) {
      this.productCollectId = productCollectId;
   }

   public int getWeight() {
      return weight;
   }

   public void setWeight(int weight) {
      this.weight = weight;
   }
}
