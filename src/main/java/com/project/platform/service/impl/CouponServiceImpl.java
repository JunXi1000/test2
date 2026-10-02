package com.project.platform.service.impl;

import com.project.platform.entity.Coupon;
import com.project.platform.entity.UserCoupon;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.CouponMapper;
import com.project.platform.mapper.UserCouponMapper;
import com.project.platform.service.CouponService;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
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

    /**
     * 结算用优惠码校验(严格模式)。
     *
     * <p>2026-09-27 TASK-000-I 之前的实现有三个信任缺陷:
     * <ol>
     *   <li><b>不查归属</b> —— 任何人输入任意码都能拿到折扣(券是发给某个用户的,不是公开发的);</li>
     *   <li><b>未命中返回 null</b> —— 控制器据此回退到硬编码的 SAVE10(10%)/VIP15(15%),
     *       那两个码在 coupon 表里根本不存在,无券记录、无核销、可无限次重复使用;</li>
     *   <li><b>不封顶</b> —— 固定额券用 {@code value.min(subtotal)} 截断是对的,
     *       但百分比券的上限只看 {@code maxDiscount},没兜住「优惠 > 小计」。</li>
     * </ol>
     * 现在改为:查不到 / 下架 / 过期 / 未领取 / 已使用 → 一律 400;金额一律封顶为小计。
     */
    @Override
    public Map<String, Object> applyByCode(String code, BigDecimal subtotal, Integer userId) {
        // 匿名无法证明「这张券是我的」。两个入口(/checkout/summary、/checkout/promo)
        // 自 2026-10-02 起都需登录(拦截器先行拦成 401),正常路径到不了这里;
        // 本判断保留为**服务层兜底**:即使有人把端点在别处直连进来,也不放行无归属的折扣。
        if (userId == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "请先登录后再使用优惠码");
        }
        Coupon coupon = couponMapper.selectByCode(code);
        // selectByCode 的 WHERE 已过滤 status='enabled' 与 expires_at,故「下架/过期」与
        // 「不存在」到这里都是 null —— 对用户而言都是「这个码不能用」,不必区分。
        if (coupon == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "优惠码无效");
        }
        // 归属:必须是**这个用户自己领的**券
        UserCoupon userCoupon = userCouponMapper.selectByUserAndCoupon(userId, coupon.getId());
        if (userCoupon == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "您未领取该优惠券");
        }
        if ("used".equals(userCoupon.getStatus())) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "该优惠券已使用");
        }
        BigDecimal minOrder = coupon.getMinOrder() == null ? BigDecimal.ZERO : coupon.getMinOrder();
        if (subtotal != null && subtotal.compareTo(minOrder) < 0) {
            // 沿用既有的 409(门槛不达标是「冲突」而非「码无效」),不改动既有错误码契约
            throw new CustomException("未达到优惠券使用门槛");
        }

        BigDecimal discount = computeDiscount(coupon, subtotal).setScale(2, RoundingMode.HALF_UP);
        Map<String, Object> result = new HashMap<>();
        result.put("code", coupon.getCode());
        result.put("title", coupon.getTitle());
        result.put("type", coupon.getType());
        result.put("discount", discount);
        // couponId 用**券码**而非主键:前端 StorefrontPromoTest 与结算页都按 code 消费它,
        // 换成数字 id 属契约变更。
        result.put("couponId", coupon.getCode());
        // 下面两个是**服务端内部用**,不进 HTTP 响应:
        //   couponIdRaw —— 核销时要按主键查 user_coupon
        //   userCouponId —— 条件 UPDATE 抢占时的主键
        result.put("couponIdRaw", coupon.getId());
        result.put("userCouponId", userCoupon.getId());
        return result;
    }

    /**
     * 核销:条件 UPDATE 抢占。受影响行数为 0 = 该券已被另一个并发请求核销掉。
     *
     * <p>用条件更新而不是「先查状态 → 判断 → 再写」:后者在无锁下两个执行流可以同时
     * 通过判断,同一张券被核销两次(等于优惠被重复享受)。
     */
    @Override
    public void redeem(Integer userId, Integer couponId) {
        if (userId == null || couponId == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "请先登录后再使用优惠码");
        }
        UserCoupon userCoupon = userCouponMapper.selectByUserAndCoupon(userId, couponId);
        if (userCoupon == null || userCouponMapper.markUsedIfUnused(userCoupon.getId()) == 0) {
            throw new CustomException(HttpStatus.CONFLICT, "该优惠券已被使用,请勿重复提交");
        }
    }

    /**
     * 按券型算折扣额。
     *
     * <p><b>最后一道防线:优惠额封顶为小计</b>(返回 {@code min(discount, subtotal)} 且非负)。
     * 没有它,构造一张「高百分比 + 无 maxDiscount」的券就能算出负数订单金额,
     * 进而让退款 / 余额扣减出现反向加钱。
     */
    private BigDecimal computeDiscount(Coupon coupon, BigDecimal subtotal) {
        if (subtotal == null || subtotal.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal value = coupon.getValue() == null ? BigDecimal.ZERO : coupon.getValue();
        BigDecimal discount;
        if ("percent".equals(coupon.getType())) {
            // value 存百分数(value=10 表示 9 折)。除法必须显式给 scale 与舍入方式,
            // 否则 BigDecimal 会因除不尽抛 ArithmeticException
            discount = subtotal.multiply(value).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            if (coupon.getMaxDiscount() != null && discount.compareTo(coupon.getMaxDiscount()) > 0) {
                discount = coupon.getMaxDiscount();
            }
        } else if ("fixed".equals(coupon.getType())) {
            discount = value;
        } else {
            discount = BigDecimal.ZERO;   // shipping 等未知券型不产生金额优惠
        }
        if (discount.compareTo(subtotal) > 0) {
            discount = subtotal;          // 封顶:优惠额不得超过商品小计
        }
        return discount.signum() < 0 ? BigDecimal.ZERO : discount;
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
