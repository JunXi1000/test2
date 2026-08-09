package com.project.platform.service.impl;

import com.project.platform.entity.Coupon;
import com.project.platform.entity.UserCoupon;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.CouponMapper;
import com.project.platform.mapper.UserCouponMapper;
import com.project.platform.service.CouponService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 优惠券服务
 */
@Service
public class CouponServiceImpl implements CouponService {

    @Resource
    private CouponMapper couponMapper;

    @Resource
    private UserCouponMapper userCouponMapper;

    @Override
    public List<Map<String, Object>> getClaimableCatalog() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Coupon coupon : couponMapper.selectEnabled()) {
            result.add(toCatalogMap(coupon));
        }
        return result;
    }

    @Override
    public List<Map<String, Object>> getMyCoupons(Integer userId) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (UserCoupon uc : userCouponMapper.selectByUserId(userId)) {
            Coupon coupon = couponMapper.selectById(uc.getCouponId());
            if (coupon == null) {
                continue;
            }
            Map<String, Object> m = toCatalogMap(coupon);
            m.put("isUsed", "used".equals(uc.getStatus()));
            m.put("claimedAt", uc.getClaimedTime() == null ? null
                    : uc.getClaimedTime().toInstant(ZoneOffset.UTC).toEpochMilli());
            result.add(m);
        }
        return result;
    }

    @Override
    public void claim(Integer userId, Integer couponId) {
        Coupon coupon = couponMapper.selectById(couponId);
        if (coupon == null || !"enabled".equals(coupon.getStatus())) {
            throw new CustomException("优惠券不存在或已下架");
        }
        if (coupon.getExpiresAt() != null && coupon.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new CustomException("优惠券已过期");
        }
        if (userCouponMapper.selectByUserAndCoupon(userId, couponId) != null) {
            throw new CustomException("您已领取过该优惠券");
        }
        if (coupon.getTotal() != null && coupon.getClaimed() != null && coupon.getClaimed() >= coupon.getTotal()) {
            throw new CustomException("优惠券已被领完");
        }
        UserCoupon uc = new UserCoupon();
        uc.setUserId(userId);
        uc.setCouponId(couponId);
        uc.setStatus("unused");
        userCouponMapper.insert(uc);
        couponMapper.incrementClaimed(couponId);
    }

    @Override
    public Map<String, Object> applyByCode(String code, Double subtotal) {
        Coupon coupon = couponMapper.selectByCode(code);
        if (coupon == null) {
            return null;
        }
        if (subtotal != null && subtotal < (coupon.getMinOrder() == null ? 0 : coupon.getMinOrder())) {
            throw new CustomException("未达到优惠券使用门槛");
        }
        double discount;
        if ("percent".equals(coupon.getType())) {
            discount = subtotal * (coupon.getValue() / 100);
            if (coupon.getMaxDiscount() != null && discount > coupon.getMaxDiscount()) {
                discount = coupon.getMaxDiscount();
            }
        } else if ("fixed".equals(coupon.getType())) {
            discount = Math.min(coupon.getValue(), subtotal);
        } else {
            discount = 0;
        }
        Map<String, Object> result = new HashMap<>();
        result.put("code", coupon.getCode());
        result.put("title", coupon.getTitle());
        result.put("type", coupon.getType());
        result.put("discount", Math.round(discount * 100) / 100.0);
        return result;
    }

    private Map<String, Object> toCatalogMap(Coupon c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", String.valueOf(c.getId()));
        m.put("code", c.getCode());
        m.put("title", c.getTitle());
        m.put("description", c.getDescription());
        m.put("type", c.getType());
        m.put("value", c.getValue());
        m.put("minOrder", c.getMinOrder() == null ? 0 : c.getMinOrder());
        m.put("maxDiscount", c.getMaxDiscount());
        m.put("category", c.getCategory());
        m.put("expiresAt", c.getExpiresAt() == null ? null
                : c.getExpiresAt().toInstant(ZoneOffset.UTC).toString());
        return m;
    }
}
