package com.project.platform.vo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 前台订单分组视图(Phase 2):一次结算(order_no)聚合成一条订单。
 * 存量旧行(order_no 为空)各自成组,orderNo 展示为 LEGACY-{id}。
 */
public class StorefrontOrderVO {
    private String orderNo;
    private String status;
    private LocalDateTime createTime;
    private BigDecimal totalMoney;
    private Integer quantity;
    private String consigneeName;
    private String consigneeTel;
    private String consigneeAddress;
    private String trackingNumber;
    private String remark;
    private List<Item> items;

    public static class Item {
        private Integer id;
        private Integer productId;
        private String productName;
        private String productMainImg;
        private BigDecimal totalMoney;
        private Integer quantity;
        private String status;

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

        public String getProductMainImg() {
            return productMainImg;
        }

        public void setProductMainImg(String productMainImg) {
            this.productMainImg = productMainImg;
        }

        public BigDecimal getTotalMoney() {
            return totalMoney;
        }

        public void setTotalMoney(BigDecimal totalMoney) {
            this.totalMoney = totalMoney;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public BigDecimal getTotalMoney() {
        return totalMoney;
    }

    public void setTotalMoney(BigDecimal totalMoney) {
        this.totalMoney = totalMoney;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
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

    public List<Item> getItems() {
        return items;
    }

    public void setItems(List<Item> items) {
        this.items = items;
    }
}
