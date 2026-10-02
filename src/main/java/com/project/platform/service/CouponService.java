package com.project.platform.service;

import java.util.List;
import java.math.BigDecimal;
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
     * 按优惠码校验并计算折扣(**结算用,严格模式**)。
     *
     * <p>与历史行为的三处根本差别(2026-09-27,TASK-000-I):
     * <ol>
     *   <li><b>必须能证明这张券是自己的</b> —— 校验 {@code user_coupon} 里存在该用户的领券记录,
     *       且状态为 {@code unused}。此前完全不查归属,任何人输入任意码都能拿到折扣。</li>
     *   <li><b>未命中即 400</b> —— 此前返回 {@code null},控制器再回退到硬编码的
     *       {@code SAVE10}/{@code VIP15},那两个码无券记录、无核销、可无限次重复使用。</li>
     *   <li><b>优惠额封顶为小计</b> —— 防止构造出负数订单。</li>
     * </ol>
     *
     * <p>{@code CouponMapper.selectByCode} 的 WHERE 已带 {@code status='enabled'} 与
     * {@code expires_at > NOW()},故「下架 / 过期」与「不存在」同样落到 400「优惠码无效」。
     *
     * @param code     优惠码
     * @param subtotal 商品小计(按 DB 价算出)
     * @param userId   当前用户 id;传 null 一律 400。两个调用方
     *                 ({@code /checkout/summary}、{@code /checkout/promo} 与
     *                 {@code /payments/create})**都已需登录**,正常路径不会是 null;
     *                 保留该拒绝是为了直连服务时也不放行「无归属凭证的折扣」。
     * @return 折扣明细(code / title / type / discount / couponId / userCouponId)
     * @throws com.project.platform.exception.CustomException 400 优惠码无效/未领取/已使用,
     *                                                        409 未达门槛(沿用既有错误码);
     *                                                        未登录在进本方法**之前**即被
     *                                                        {@code LoginInterceptor} 拦成 401
     */
    Map<String, Object> applyByCode(String code, BigDecimal subtotal, Integer userId);

    /**
     * 核销优惠券(**副作用**,只能在真正落单时调用)。
     *
     * <p>用条件 UPDATE 抢占({@code status='unused'}):受影响行数为 0 表示这张券已被
     * 并发提交核销掉,抛 409 拒绝。调用方须保证整个下单流程在同一事务里,
     * 使「核销成功但订单失败」能回滚。
     *
     * @param userId   用户 id
     * @param couponId 券 id
     */
    void redeem(Integer userId, Integer couponId);
}
