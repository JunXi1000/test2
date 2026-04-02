package com.project.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class CreateOrderByShoppingCartDTO {
    /**
     * 购物车ids
     */
    @NotEmpty(message = "请选择购物车商品")
    private List<Integer> ids;

    /**
     * 收货人姓名
     */
    @NotBlank(message = "收货人姓名不能为空")
    private String consigneeName;
    /**
     * 收货人电话
     */
    @NotBlank(message = "收货人电话不能为空")
    private String consigneeTel;
    /**
     * 收货人地址
     */
    @NotBlank(message = "收货人地址不能为空")
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
