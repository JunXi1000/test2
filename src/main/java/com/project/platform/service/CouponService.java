package com.project.platform.service;

import java.util.List;
import java.util.Map;

/**
 * 优惠券服务
 */
public interface CouponService {

    /**
     * 可领取的优惠券目录(前端 Coupon 形状,不含 isUsed/claimedAt)
     */
    List<Map<String, Object>> getClaimableCatalog();

    /**
     * 当前用户已领取的优惠券(完整 Coupon 形状)
     */
    List<Map<String, Object>> getMyCoupons(Integer userId);

    /**
     * 领取优惠券
     */
    void claim(Integer userId, Integer couponId);

    /**
     * 按优惠码对订单校验并计算折扣
     */
    Map<String, Object> applyByCode(String code, Double subtotal);
}
