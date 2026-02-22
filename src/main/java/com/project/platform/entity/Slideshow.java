package com.project.platform.entity;

import java.time.LocalDateTime;
/**
 * 轮播图
 */
public class Slideshow  {
   /**
    * id
    */
   private Integer id;
   /**
   * 标题
   */
   private String title;
   /**
   * 封面图
   */
   private String mainImg;
   /**
   * 链接
   */
   private String link;
   /**
   * 排序
   */
   private Integer sort;
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
   public String getTitle() {
      return title;
   }

   public void setTitle(String title) {
      this.title = title;
   }

   public String getMainImg() {
      return mainImg;
   }

   public void setMainImg(String mainImg) {
      this.mainImg = mainImg;
   }

   public String getLink() {
      return link;
   }

   public void setLink(String link) {
      this.link = link;
   }

   public Integer getSort() {
      return sort;
   }

   public void setSort(Integer sort) {
      this.sort = sort;
   }

   public LocalDateTime getCreateTime() {
      return createTime;
   }

   public void setCreateTime(LocalDateTime createTime) {
      this.createTime = createTime;
   }


}
