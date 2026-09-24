package com.project.platform.service.impl;

import com.project.platform.entity.Coupon;
import com.project.platform.entity.UserCoupon;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.CouponMapper;
import com.project.platform.mapper.UserCouponMapper;
import com.project.platform.service.CouponService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

    /** 百分数换算用常量(避免裸字面量 100 与 BigDecimal 混算) */
    private static final BigDecimal HUNDRED = new BigDecimal("100");

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

    /**
     * 领券。
     *
     * <p>必须带事务:{@code user_coupon} 插一行 + {@code coupon.claimed} 加一,两处写要么都成、
     * 要么都不成。此前无事务 —— 若第二步失败,用户会拿到券而计数没加(超出总量)。
     * <p>并发下的重复领取由 DB 唯一键 {@code uk_user_coupon(user_id, coupon_id)} 兜底:
     * 先查后插的竞态会撞唯一键抛异常,事务随之回滚,不会留下脏数据。
     */
    @Transactional(rollbackFor = Exception.class)
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
    public Map<String, Object> applyByCode(String code, BigDecimal subtotal) {
        Coupon coupon = couponMapper.selectByCode(code);
        if (coupon == null) {
            return null;
        }
        BigDecimal minOrder = coupon.getMinOrder() == null ? BigDecimal.ZERO : coupon.getMinOrder();
        if (subtotal != null && subtotal.compareTo(minOrder) < 0) {
            throw new CustomException("未达到优惠券使用门槛");
        }
        BigDecimal discount;
        if ("percent".equals(coupon.getType())) {
            // value 存百分数(value=10 表示 9 折)。除法必须显式给 scale 与舍入方式,
            // 否则 BigDecimal 会因除不尽抛 ArithmeticException
            BigDecimal rate = coupon.getValue() == null ? BigDecimal.ZERO : coupon.getValue();
            discount = subtotal.multiply(rate).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            if (coupon.getMaxDiscount() != null && discount.compareTo(coupon.getMaxDiscount()) > 0) {
                discount = coupon.getMaxDiscount();
            }
        } else if ("fixed".equals(coupon.getType())) {
            BigDecimal value = coupon.getValue() == null ? BigDecimal.ZERO : coupon.getValue();
            discount = value.min(subtotal);
        } else {
            discount = BigDecimal.ZERO;
        }
        Map<String, Object> result = new HashMap<>();
        result.put("code", coupon.getCode());
        result.put("title", coupon.getTitle());
        result.put("type", coupon.getType());
        result.put("discount", discount.setScale(2, RoundingMode.HALF_UP));
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
