package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code POST /checkout/promo} 的折扣计算与券有效性回归网。
 *
 * <p>该端点在白名单里(匿名可访问),前端结算页用它算优惠。Phase 2d 把折扣运算从
 * {@code double} + {@code Math.round(x*100)/100.0} 换成了 {@code BigDecimal} +
 * {@code setScale(2, RoundingMode.HALF_UP)},本类钉住:
 * <ul>
 *   <li>三种券型的折扣额(百分比 / 固定额 / 未知类型→0);</li>
 *   <li>百分比的上限封顶(maxDiscount);</li>
 *   <li>门槛校验(未达标 → 409);</li>
 *   <li>除不尽时的舍入(8% × 33.33 = 2.6664 → 2.67);</li>
 *   <li>响应里 {@code discount} 仍是 JSON <b>数字</b> —— 前端契约不变(BigDecimal 序列化为数字)。</li>
 * </ul>
 *
 * <p><b>券的有效性校验在 mapper 的 SQL 里,不在 service 里</b> ——
 * {@code CouponMapper.selectByCode} 的 WHERE 带了 {@code status = 'enabled'} 与
 * {@code expires_at > NOW()};查不到就返回 null,控制器随即回退到硬编码的遗留优惠码表。
 * 所以下面测折扣运算时必须先用 {@link #makeValid} / {@link #makePermanent} 把种子券改成有效,
 * 否则拿到的会是**回退表**的结果而不是券的结果 —— 这一点极易误判,本类头两版测试就栽在这里。
 *
 * <p>种子券的 {@code expires_at} 全部早于 2026-09-24(仅 FREESHIP 未过期),
 * 因此 {@link #expiredCouponIsIgnored()} 与 {@link #disabledCouponIsIgnored()} 天然可测。
 *
 * <p>断言用 fastjson 解析后按 double 带容差比较(与 {@code StorefrontPaymentControllerTest} 同写法),
 * 避免 JsonPath 对 JSON 数字解析类型的比较歧义。
 */
class StorefrontPromoTest extends BaseControllerTest {

    private static final double DELTA = 0.001;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("百分比券:10% × 150 = 15.00(未触发上限)")
    void percentCouponBelowCap() throws Exception {
        makePermanent("WELCOME10");
        assertEquals(15.00, discountOf("WELCOME10", "150"), DELTA);
    }

    @Test
    @DisplayName("百分比券:15% × 400 = 60.00,但 maxDiscount=50 封顶 → 50.00")
    void percentCouponCappedByMaxDiscount() throws Exception {
        makePermanent("VIP15");
        assertEquals(50.00, discountOf("VIP15", "400"), DELTA);
    }

    @Test
    @DisplayName("百分比券除不尽:8% × 33.33 = 2.6664 → HALF_UP 到分 → 2.67")
    void percentCouponRoundsHalfUpToCents() throws Exception {
        makePermanent("PHONE8");
        assertEquals(2.67, discountOf("PHONE8", "33.33"), DELTA);
    }

    @Test
    @DisplayName("固定额券:$20 off,subtotal 150 → 20.00,并回传 couponId")
    void fixedCoupon() throws Exception {
        makePermanent("SAVE20");
        JSONObject data = dataOf(promo("SAVE20", "150").andReturn());
        assertEquals(20.00, data.getDoubleValue("discount"), DELTA);
        assertEquals("SAVE20", data.getString("couponId"));
    }

    @Test
    @DisplayName("固定额券门槛边界:subtotal 恰好等于 min_order(100)→ 给 20.00")
    void fixedCouponAtExactMinOrder() throws Exception {
        makePermanent("SAVE20");
        assertEquals(20.00, discountOf("SAVE20", "100"), DELTA);
        // 注:种子里没有「固定额 > 小计 且 小计 ≥ 门槛」的券(SAVE20: value 20/min 100;
        // OFFICE10: value 10/min 50),所以 `value.min(subtotal)` 的截断分支**未被覆盖** ——
        // 不写一条名字像在测它、实际测不到的用例。
    }

    @Test
    @DisplayName("未达门槛 → 409(门槛校验在 service 里)")
    void belowMinOrderRejected() throws Exception {
        makePermanent("SAVE20");
        promo("SAVE20", "50")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));
    }

    @Test
    @DisplayName("未知券型(shipping)→ discount 0,不报错")
    void unknownCouponTypeYieldsZero() throws Exception {
        // FREESHIP 是唯一**未过期**的种子券,无需 makePermanent
        assertEquals(0.00, discountOf("FREESHIP", "150"), DELTA);
    }

    // ─────────────── 券有效性(mapper SQL 里的 status / expires_at 过滤) ───────────────

    @Test
    @DisplayName("过期券不生效:SAVE20 保持过期 → 查不到 → 回退表 → 0.00(而非 20.00)")
    void expiredCouponIsIgnored() throws Exception {
        // 不做 makePermanent。若过期校验缺失,这里会拿到券的 20.00;拿到 0.00 才说明过滤生效
        assertEquals(0.00, discountOf("SAVE20", "150"), DELTA);
    }

    @Test
    @DisplayName("下架券不生效:SAVE20 未过期但 disabled → 查不到 → 回退表(该码不在回退表里)→ 0.00")
    void disabledCouponIsIgnored() throws Exception {
        makePermanent("SAVE20");   // 未过期,但下架
        jdbcTemplate.update("UPDATE coupon SET status = 'disabled' WHERE code = ?", "SAVE20");
        // SAVE20 不在控制器的遗留回退表({SAVE10, VIP15})里,所以「券被过滤掉」与
        // 「券生效」的差别是可观测的:0.00 vs 20.00 ✓ 这条断言有判别力
        assertEquals(0.00, discountOf("SAVE20", "150"), DELTA);
    }

    // ─────────────── 遗留回退表(不在 coupon 表里的码) ───────────────

    @Test
    @DisplayName("不在 coupon 表的码走遗留回退表:SAVE10 → 10% × 150 = 15.00")
    void legacyFallbackCodeStillWorks() throws Exception {
        assertEquals(15.00, discountOf("SAVE10", "150"), DELTA);
    }

    @Test
    @DisplayName("完全未知的码 → 0.00(不报错)")
    void unknownCodeYieldsZero() throws Exception {
        assertEquals(0.00, discountOf("NO_SUCH_CODE", "150"), DELTA);
    }

    // ─────────────────────────── helpers ───────────────────────────

    /**
     * 把种子券改成「未过期且启用」,好让 {@code selectByCode} 能查到它。
     * 本类继承 {@code BaseControllerTest}(@Transactional),所以这处 UPDATE 会随测试回滚。
     */
    private void makePermanent(String code) {
        jdbcTemplate.update(
                "UPDATE coupon SET expires_at = '2099-01-01 00:00:00', status = 'enabled' WHERE code = ?", code);
    }

    /** POST /checkout/promo(白名单端点,不需要 token),返回 data.discount;隐含要求 200 */
    private double discountOf(String code, String subtotal) throws Exception {
        return dataOf(promo(code, subtotal).andExpect(status().isOk()).andReturn())
                .getDoubleValue("discount");
    }

    /** 发请求但不预设状态码 —— 由各用例自己断言(门槛不达标时是 409) */
    private ResultActions promo(String code, String subtotal) throws Exception {
        return post("/checkout/promo", "", Map.of("code", code, "subtotal", subtotal));
    }

    private JSONObject dataOf(MvcResult result) throws Exception {
        return JSONObject.parseObject(
                        result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data");
    }
}
