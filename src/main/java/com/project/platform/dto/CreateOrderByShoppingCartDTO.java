package com.project.platform.dto;

import java.util.List;

public class CreateOrderByShoppingCartDTO {
    /**
     * 购物车ids
     */
    List<Integer> ids;

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
     * 备注
     */
    private String remark;

    public List<Integer> getIds() {
        return ids;
    }

    public void setIds(List<Integer> ids) {
        this.ids = ids;
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

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
