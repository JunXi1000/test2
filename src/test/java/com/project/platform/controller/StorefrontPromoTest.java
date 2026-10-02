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
 * <h2>契约(TASK-002 冻结 C0/C2)</h2>
 * <ul>
 *   <li><b>C0</b>:该端点<b>已移出</b> {@code SpringMvcConfig} 白名单 ⇒ <b>匿名 401</b>。
 *       这是对 TASK-001 BLK-1 的修复:此前它在白名单里 ⇒ {@code LoginInterceptor} 不跑 ⇒
 *       {@code CurrentUserThreadLocal} 为空 ⇒ {@code currentUserId()} 恒 null ⇒
 *       {@code CouponServiceImpl.applyByCode} 对所有请求(含合法登录态)一律 400
 *       「请先登录后再使用优惠码」—— 券入口对<b>所有人</b>不可用。</li>
 *   <li><b>C2</b>:必须登录 <b>且</b> 必须<b>已领取</b>该券 → 200 {@code {discount}}。
 *       反例分两档,msg 可区分:
 *       <b>400</b> = 这个码不能用(未领取 / 已使用 / 已过期或已下架=「优惠码无效」);
 *       <b>409</b> = 码可用但当前这笔单不满足条件(未达 {@code min_order} 门槛)——
 *       门槛沿用既有 409(「与资源当前状态冲突」),不改成 400。
 *       <b>不得</b>恢复 SAVE10/VIP15 硬编码兜底。</li>
 * </ul>
 *
 * <h2>本类为什么必须让请求带 token(改动原因)</h2>
 * <p>旧版全部用 {@code post(url, "", body)}(空 token)按「匿名可用」的旧契约编写。
 * C0 之后空 token = 匿名 = 401,所以每个用例都必须显式传 {@link #userToken()},
 * <b>并且</b>先替该用户 {@link #claim(String) 领取}目标券 —— 否则拿到的会是
 * 「您未领取该优惠券」而不是折扣额。这两件事缺一不可,旧版栽在后者上过一次。
 *
 * <h2>硬编码兜底已删除(旧用例的处置)</h2>
 * <p>旧版有两条用例断言「不在 coupon 表的码走遗留回退表」:
 * {@code SAVE10 → 15.00}、{@code NO_SUCH_CODE → 0.00}。兜底码已在 TASK-000 Phase 3 删除,
 * 两条均改为断言 <b>400 且 msg=「优惠码无效」</b> —— 即「这个码不能用」,
 * 而<b>不是</b>「静默按 0 元折扣放行」(后者会让结算页显示一个假的可用优惠)。
 *
 * <p>断言用 fastjson 解析后按 double 带容差比较(与 {@code StorefrontPaymentControllerTest} 同写法),
 * 避免 JsonPath 对 JSON 数字解析类型的比较歧义。
 */
class StorefrontPromoTest extends BaseControllerTest {

    private static final double DELTA = 0.001;

    /** 券码无效(不存在 / 已下架 / 已过期的统一文案,见 CouponServiceImpl:120-122) */
    private static final String MSG_INVALID_CODE = "优惠码无效";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // ═══════════════════════ 正例:已登录 + 已领券 → 200 且减免正确 ═══════════════════════

    @Test
    @DisplayName("C0/C2 回归锚点:登录 + 已领券 → promo 200 且减免正确(不再被白名单「杀死」)")
    void loggedInWithClaimedCouponGetsRealDiscount() throws Exception {
        makePermanent("WELCOME10");
        claim("WELCOME10");
        JSONObject data = dataOf(promo("WELCOME10", "150")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn());
        assertEquals(15.00, data.getDoubleValue("discount"), DELTA, "10% × 150 = 15.00");
        assertEquals("WELCOME10", data.getString("couponId"), "couponId 回传的是**券码**而非主键");
        assertEquals("WELCOME10", data.getString("code"));
        assertEquals("percent", data.getString("type"));
    }

    @Test
    @DisplayName("百分比券:10% × 150 = 15.00(未触发上限)")
    void percentCouponBelowCap() throws Exception {
        makePermanent("WELCOME10");
        claim("WELCOME10");
        assertEquals(15.00, discountOf("WELCOME10", "150"), DELTA);
    }

    @Test
    @DisplayName("百分比券:15% × 400 = 60.00,但 maxDiscount=50 封顶 → 50.00")
    void percentCouponCappedByMaxDiscount() throws Exception {
        makePermanent("VIP15");
        claim("VIP15");
        assertEquals(50.00, discountOf("VIP15", "400"), DELTA);
    }

    @Test
    @DisplayName("百分比券除不尽:8% × 33.33 = 2.6664 → HALF_UP 到分 → 2.67")
    void percentCouponRoundsHalfUpToCents() throws Exception {
        makePermanent("PHONE8");
        claim("PHONE8");
        assertEquals(2.67, discountOf("PHONE8", "33.33"), DELTA);
    }

    @Test
    @DisplayName("固定额券:$20 off,subtotal 150 → 20.00,并回传 couponId")
    void fixedCoupon() throws Exception {
        makePermanent("SAVE20");
        claim("SAVE20");
        JSONObject data = dataOf(promo("SAVE20", "150").andExpect(status().isOk()).andReturn());
        assertEquals(20.00, data.getDoubleValue("discount"), DELTA);
        assertEquals("SAVE20", data.getString("couponId"));
    }

    @Test
    @DisplayName("固定额券门槛边界:subtotal 恰好等于 min_order(100)→ 给 20.00")
    void fixedCouponAtExactMinOrder() throws Exception {
        makePermanent("SAVE20");
        claim("SAVE20");
        assertEquals(20.00, discountOf("SAVE20", "100"), DELTA);
        // 注:种子里没有「固定额 > 小计 且 小计 ≥ 门槛」的券(SAVE20: value 20/min 100;
        // OFFICE10: value 10/min 50),所以 `value.min(subtotal)` 的截断分支**未被覆盖** ——
        // 不写一条名字像在测它、实际测不到的用例。
    }

    @Test
    @DisplayName("未知券型(shipping)→ discount 0,不报错")
    void unknownCouponTypeYieldsZero() throws Exception {
        // FREESHIP 是唯一**未过期**的种子券(expires_at=2026-10-07),无需 makePermanent。
        // 但 C2 之后仍需先领取,否则会先撞「您未领取该优惠券」。
        claim("FREESHIP");
        assertEquals(0.00, discountOf("FREESHIP", "150"), DELTA);
    }

    // ═══════════════════════ C0:匿名 → 401(白名单已移除) ═══════════════════════

    @Test
    @DisplayName("C0 回归锚点:匿名(无有效 token)访问 promo → 401")
    void anonymousPromoIsRejected() throws Exception {
        // 必须以**匿名**身份发请求。早先此用例写的是 promo(...),而那个 helper 传的是
        // userToken() ⇒ 它其实是「已登录」路径,拿到的是控制器的 400,测不到 C0。
        // 现在显式用空 token(拦截器读不到有效 token ⇒ 401「未登录或登录已过期」)。
        post("/checkout/promo", "", Map.of("code", "WELCOME10", "subtotal", "198"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    // ═══════════════════════ 反例:未领 / 已用 / 过期 / 未达门槛 ═══════════════════════

    @Test
    @DisplayName("已登录但未领券 → 400「您未领取该优惠券」")
    void unclaimedCouponIsRejected() throws Exception {
        makePermanent("SAVE20");
        // 刻意不 claim
        promo("SAVE20", "150")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("您未领取该优惠券"));
    }

    @Test
    @DisplayName("已领但已使用 → 400「该优惠券已使用」")
    void usedCouponIsRejected() throws Exception {
        makePermanent("AUDIO15");
        claim("AUDIO15");
        jdbcTemplate.update("UPDATE user_coupon SET status = 'used' WHERE user_id = 1 AND coupon_id = "
                + "(SELECT id FROM coupon WHERE code = 'AUDIO15')");
        promo("AUDIO15", "150")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("该优惠券已使用"));
    }

    @Test
    @DisplayName("券已过期:SAVE20 种子即过期 → 400「优惠码无效」(filter 生效,绝不给 20.00)")
    void expiredCouponIsRejected() throws Exception {
        // 不做 makePermanent:SAVE20 的种子 expires_at = 2026-08-22,已过期。
        // 若过期校验缺失,这里会拿到券的 20.00;拿到 400 才说明 selectByCode 的
        // `expires_at > NOW()` 过滤生效。旧版断言的是 0.00(靠已删除的兜底表),
        // C2 之后「不可用」的正确表达是明确拒绝,而不是静默按 0 元放行。
        promo("SAVE20", "150")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value(MSG_INVALID_CODE));
    }

    @Test
    @DisplayName("券已下架:未过期但 disabled → 400「优惠码无效」")
    void disabledCouponIsRejected() throws Exception {
        makePermanent("OFFICE10");
        claim("OFFICE10");
        jdbcTemplate.update("UPDATE coupon SET status = 'disabled' WHERE code = ?", "OFFICE10");
        // OFFICE10 不在任何遗留兜底表里,所以「券被过滤掉」与「券生效」的差别可观测:
        // 400 vs 10.00 ✓ 这条断言有判别力
        promo("OFFICE10", "150")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value(MSG_INVALID_CODE));
    }

    @Test
    @DisplayName("未达门槛 → 409(门槛校验在 service 里,沿用既有错误码)")
    void belowMinOrderRejected() throws Exception {
        makePermanent("SAVE20");
        claim("SAVE20");
        promo("SAVE20", "50")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.msg").value("未达到优惠券使用门槛"));
    }

    // ═══════════════════════ 已废除的硬编码兜底码(旧用例改判) ═══════════════════════

    @Test
    @DisplayName("已废除的兜底码 SAVE10 → 400「优惠码无效」(不再回退到 10% 硬编码表)")
    void legacyFallbackCodeIsRejected() throws Exception {
        // 旧断言:SAVE10 → 15.00(控制器里的硬编码回退表)。
        // 该表已在 TASK-000 Phase 3 删除 —— 兜底码在 coupon 表里没有记录,
        // 无券可核销、可无限次重复使用,属资损面,故改成明确拒绝。
        promo("SAVE10", "150")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value(MSG_INVALID_CODE));
    }

    @Test
    @DisplayName("完全未知的码 → 400「优惠码无效」(不再静默按 0 元折扣放行)")
    void unknownCodeIsRejected() throws Exception {
        // 旧断言:NO_SUCH_CODE → discount 0.00 + 200。
        // 「静默 0」比「明确拒绝」更糟:结算页会显示「优惠已应用」却一分不减。
        promo("NO_SUCH_CODE", "150")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value(MSG_INVALID_CODE));
    }

    // ═══════════════════════ 入参校验(400,未受本次改动影响) ═══════════════════════

    @Test
    @DisplayName("缺 code → 400「优惠码不能为空」(先过鉴权,再入校验)")
    void missingCodeIsBadRequest() throws Exception {
        post("/checkout/promo", userToken(), Map.of("subtotal", "150"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("优惠码不能为空"));
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

    /**
     * 替 user 1 **领取**目标券 —— C2 之后「已领取」是 200 的必要条件之一。
     *
     * <p>直接用 {@code user_coupon} 表的真实形状插入,而不是走 {@code POST /coupons/{id}/claim}:
     * 本类要测的是 promo 的折扣与券有效性,领取端点有自己的覆盖(
     * {@code CouponControllerTest} / {@code AuthorizationBaselineTest})。
     * 走 HTTP 领取会把两件事耦合在一起 —— 领取一坏,本类 10 条用例全红,掩盖真正的失败点。
     */
    private void claim(String code) {
        Integer couponId = jdbcTemplate.queryForObject(
                "SELECT id FROM coupon WHERE code = ?", Integer.class, code);
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_coupon WHERE user_id = 1 AND coupon_id = ?", Integer.class, couponId);
        if (existing != null && existing > 0) {
            return; // UNIQUE(user_id, coupon_id) —— 已领则不重复插入
        }
        jdbcTemplate.update(
                "INSERT INTO user_coupon (user_id, coupon_id, status) VALUES (1, ?, 'unused')", couponId);
    }

    /** POST /checkout/promo(**带 user1 的 token**),返回 data.discount;隐含要求 200 */
    private double discountOf(String code, String subtotal) throws Exception {
        return dataOf(promo(code, subtotal).andExpect(status().isOk()).andReturn())
                .getDoubleValue("discount");
    }

    /** 发请求但**不**预设状态码 —— 由各用例自己断言(401 / 400 / 409 各有其用例) */
    private ResultActions promo(String code, String subtotal) throws Exception {
        return post("/checkout/promo", userToken(), Map.of("code", code, "subtotal", subtotal));
    }

    private JSONObject dataOf(MvcResult result) throws Exception {
        return JSONObject.parseObject(
                        result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data");
    }
}
