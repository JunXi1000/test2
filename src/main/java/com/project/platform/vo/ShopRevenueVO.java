package com.project.platform.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理端商家列表里的「累计销售额」。
 *
 * <p>{@code shopId} 可能在 {@code shop} 表里没有对应订单行(新入驻商家),
 * 因此聚合走 LEFT JOIN 并以 {@code COALESCE(...,0)} 兜底,服务层不会再判空。
 */
@Data
public class ShopRevenueVO {

    /** 店铺 id */
    private Integer shopId;

    /** 累计已支付金额(排除待支付/已取消) */
    private BigDecimal revenue;
}
