package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.ProductOrder;
import com.project.platform.mapper.PaymentMapper;
import com.project.platform.mapper.ProductOrderMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 金额一致性的**强锚点** —— TASK-002 契约 C3/C4,以及 TASK-001 BLK-4 的回归网。
 *
 * <h2>为什么需要它</h2>
 * <p>TASK-001 实测发现:结算页展示的金额、{@code /payments/create} 实际扣款、
 * {@code payment.amount}、{@code Σ product_order.total_money} 这四处**没有任何自动化测试
 * 把它们放在一起比对**。结果就是 BLK-4 —— 后端把 {@code code}(优惠券)通道做好了,
 * 而前端从不发送,两边各自"看起来正常",只有手工走一遍真实链路才发现展示额与实扣额不等。
 *
 * <p>本类把四者钉在一次调用链里:
 * <pre>
 *   GET  /checkout/summary {items, code}  →  total
 *   POST /payments/create  {items, code}  →  amount
 *   POST /payments/confirm {paymentId}    →  succeeded
 *   DB   payment.amount                   == amount
 *   DB   Σ product_order.total_money      == amount
 * </pre>
 * 任何一处口径漂移都会让本类变红。**含用券场景是刻意的** —— 无券时四处相等是平凡的,
 * 用券时「summary 已减折扣」与「create 再减一次」或「只减一处」这类错误才会暴露。
 *
 * <h2>C3 的另一半:前端传的金额一律忽略</h2>
 * <p>{@link #serverRecalculatesPriceEvenIfClientSendsItsOwn()} 把「篡改 price/amount 无效」钉住 ——
 * 这条是好的现状,不许改坏。
 *
 * <h2>C0:本类每个请求都必须带 token</h2>
 * <p>{@code /checkout/summary} 已移出白名单 ⇒ 匿名 401。旧版测试按匿名契约发请求
 * (空 token),C0 之后那些用例拿到的是 401 而不是业务码。
 */
class CheckoutMoneyConsistencyTest extends BaseControllerTest {

    private static final double DELTA = 0.001;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PaymentMapper paymentMapper;

    @Autowired
    private ProductOrderMapper productOrderMapper;

    // ═══════════════════ C4:无券场景四处一致 ═══════════════════

    @Test
    @DisplayName("C4 金额四方一致(无券):summary.total == create.amount == payment.amount == Σ product_order.total_money")
    void fourAmountsAgreeWithoutCoupon() throws Exception {
        // 商品 1 的 DB 价 99.00 × 2 = 198.00
        double summaryTotal = summaryTotal(Map.of("items", List.of(Map.of("productId", 1, "quantity", 2))));
        assertEquals(198.00, summaryTotal, DELTA, "summary 必须按 DB 价重算");

        JSONObject created = createPayment(Map.of(
                "items", List.of(Map.of("productId", 1, "quantity", 2)),
                "channel", "card"));
        String orderNo = created.getString("orderId");
        assertEquals(summaryTotal, created.getDoubleValue("amount"), DELTA,
                "C4:summary.total 与 /payments/create.amount 必须相等");

        assertDbAmountsMatch(orderNo, summaryTotal);
    }

    // ═══════════════════ C3/C4:用券场景(本轮核心) ═══════════════════

    @Test
    @DisplayName("C3/C4 金额四方一致(用券):code 在 summary 与 create 同源生效,且券恰好核销一次")
    void fourAmountsAgreeWithCouponAndCouponIsRedeemed() throws Exception {
        // 券必须先「已领取」,否则 /payments/create 会在核销前就 400(您未领取该优惠券)
        makePermanent("WELCOME10");
        claim("WELCOME10");

        // WELCOME10 = 10% off,cap 20 → 198.00 × 10% = 19.80
        double expected = 198.00 - 19.80;

        JSONObject summary = summary(Map.of(
                "items", List.of(Map.of("productId", 1, "quantity", 2)),
                "code", "WELCOME10"));
        assertEquals(198.00, summary.getDoubleValue("subtotal"), DELTA);
        assertEquals(19.80, summary.getDoubleValue("discount"), DELTA, "C1:summary 必须应用券折扣");
        assertEquals("WELCOME10", summary.getString("discountCode"));
        assertEquals(expected, summary.getDoubleValue("total"), DELTA);

        JSONObject created = createPayment(Map.of(
                "items", List.of(Map.of("productId", 1, "quantity", 2)),
                "channel", "card",
                "code", "WELCOME10"));
        String orderNo = created.getString("orderId");
        assertEquals(expected, created.getDoubleValue("amount"), DELTA,
                "C4:用券时 summary.total 与 create.amount 仍必须相等(BLK-4 的回归点)");

        assertDbAmountsMatch(orderNo, expected);

        // 券必须被**核销一次**:同一张券再用必须失败(CouponServiceImpl.redeem 的条件 UPDATE)
        Integer used = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_coupon WHERE user_id = 1 AND status = 'used' AND coupon_id = "
                        + "(SELECT id FROM coupon WHERE code = 'WELCOME10')", Integer.class);
        assertEquals(1, used, "下单成功后该券应恰好被核销一次");

        post("/payments/create", userToken(), Map.of(
                "items", List.of(Map.of("productId", 1, "quantity", 1)),
                "channel", "card",
                "code", "WELCOME10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("该优惠券已使用"));
    }

    @Test
    @DisplayName("C1 summary:带 code 但未领取 → 400「您未领取该优惠券」(不会静默按 0 折扣返回)")
    void summaryWithUnclaimedCouponIsRejected() throws Exception {
        makePermanent("SAVE20");
        post("/checkout/summary", userToken(), Map.of(
                "items", List.of(Map.of("productId", 1, "quantity", 2)),
                "code", "SAVE20"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.msg").value("您未领取该优惠券"));
    }

    @Test
    @DisplayName("C1 summary:无 code → 200 且 discount=0(不是 400,也不是拒绝)")
    void summaryWithoutCodeHasZeroDiscount() throws Exception {
        JSONObject data = summary(Map.of("items", List.of(Map.of("productId", 1, "quantity", 1))));
        assertEquals(99.00, data.getDoubleValue("subtotal"), DELTA);
        assertEquals(0.00, data.getDoubleValue("discount"), DELTA);
        assertEquals(99.00, data.getDoubleValue("total"), DELTA);
    }

    @Test
    @DisplayName("C0 回归锚点:匿名 /checkout/summary → 401(移出白名单后由拦截器统一产生)")
    void anonymousSummaryIsRejected() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.post("/checkout/summary")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"productId\":1,\"quantity\":1}]}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    // ═══════════════════ C3:篡改前端金额无效(现状正确,钉住不许改坏) ═══════════════════

    @Test
    @DisplayName("C3 篡改无效:请求体里塞 price/total/amount 一律被忽略,金额按 DB 价重算")
    void serverRecalculatesPriceEvenIfClientSendsItsOwn() throws Exception {
        Map<String, Object> tampered = new LinkedHashMap<>();
        tampered.put("items", List.of(new LinkedHashMap<>(Map.of(
                "productId", 1, "quantity", 2, "price", 0.01))));
        tampered.put("total", 0.02);
        tampered.put("amount", 0.02);

        // summary:198.00 而不是 0.02
        JSONObject data = summary(tampered);
        assertEquals(198.00, data.getDoubleValue("subtotal"), DELTA, "前端传的 price 必须被忽略");
        assertEquals(198.00, data.getDoubleValue("total"), DELTA, "前端传的 total 必须被忽略");

        // create:amount 也是 99.00,且 DB 订单行按 DB 价落库
        Map<String, Object> createBody = new LinkedHashMap<>();
        createBody.put("items", List.of(new LinkedHashMap<>(Map.of(
                "productId", 1, "quantity", 1, "price", 0.01))));
        createBody.put("amount", 0.01);
        createBody.put("currency", "USD");
        createBody.put("channel", "card");
        JSONObject created = createPayment(createBody);
        assertEquals(99.00, created.getDoubleValue("amount"), DELTA, "前端传的 amount 必须被忽略");

        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(created.getString("orderId"));
        assertNotNull(rows, "按 order_no 必须能查回订单行");
        assertEquals(1, rows.size());
        assertEquals(0, new BigDecimal("99.00").compareTo(rows.get(0).getTotalMoney()),
                "订单行 total_money 必须按 DB 价算,got: " + rows.get(0).getTotalMoney());
    }

    // ─────────────────────────── helpers ───────────────────────────

    /** POST /checkout/summary(带 user1 token),要求 200,返回 data 对象 */
    private JSONObject summary(Object body) throws Exception {
        MvcResult result = post("/checkout/summary", userToken(), body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return JSONObject.parseObject(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data");
    }

    private double summaryTotal(Object body) throws Exception {
        return summary(body).getDoubleValue("total");
    }

    /** POST /payments/create(带 user1 token),要求 200,返回 data 对象 */
    private JSONObject createPayment(Object body) throws Exception {
        MvcResult result = post("/payments/create", userToken(), body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return JSONObject.parseObject(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data");
    }

    /**
     * 支付成功后再比对 DB 两处金额 —— 必须先 confirm,否则订单行仍是待支付、
     * payment.status 仍是待支付,拿到的是「下单快照」而不是「实付」。
     */
    private void assertDbAmountsMatch(String orderNo, double expectedAmount) throws Exception {
        post("/payments/confirm", userToken(), Map.of("paymentId", orderNo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("succeeded"));

        assertEquals(0, new BigDecimal(String.valueOf(expectedAmount))
                        .compareTo(paymentMapper.selectByOrderNo(orderNo).getAmount()),
                "payment.amount 必须等于应付金额");

        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        assertNotNull(rows, "按 order_no 必须能查回订单行");
        assertFalse(rows.isEmpty(), "按 order_no 必须能查回订单行");
        BigDecimal sum = rows.stream()
                .map(ProductOrder::getTotalMoney)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, new BigDecimal(String.valueOf(expectedAmount)).compareTo(sum),
                "Σ product_order.total_money 必须等于应付金额(优惠按行分摊后也不得差一分), got: " + sum);
    }

    /** 让种子券可用(未过期、启用);@Transactional 会随测试回滚 */
    private void makePermanent(String code) {
        jdbcTemplate.update(
                "UPDATE coupon SET expires_at = '2099-01-01 00:00:00', status = 'enabled' WHERE code = ?", code);
    }

    /** 替 user 1 领券(直接写 user_coupon,避免把领取端点耦合进来) */
    private void claim(String code) {
        Integer couponId = jdbcTemplate.queryForObject(
                "SELECT id FROM coupon WHERE code = ?", Integer.class, code);
        jdbcTemplate.update(
                "INSERT INTO user_coupon (user_id, coupon_id, status) VALUES (1, ?, 'unused')", couponId);
    }
}
