package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.ProductOrder;
import com.project.platform.mapper.PaymentMapper;
import com.project.platform.mapper.ProductMapper;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.mapper.UserMapper;
import com.project.platform.service.ProductOrderService;
import com.project.platform.task.OrderTimeoutTask;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 取消订单的**行为回归网**。
 *
 * 覆盖三条取消入口,外加超时扫描的批量上限:
 * <ul>
 *   <li>用户手动取消:{@code POST /orders/{orderNo}/cancel} → {@code cancelByOrderNo}(按分组)</li>
 *   <li>超时自动取消:{@code OrderTimeoutTask} → {@code cancelTimeoutOrder}(按分组)</li>
 *   <li>商家端取消:{@code PUT /merchant/orders/{id}/status}(status=cancelled) → 委派给上面两条之一</li>
 * </ul>
 *
 * <p><b>本类曾是特性化测试(characterization test)</b>:Phase 0 时它断言的是重构**前**的真实行为,
 * 其中 {@code cardPaidCancelDoesNotCreditBalance} 当时断言的是一条缺陷 —— card 渠道支付的订单被取消时
 * 会把退款充进余额钱包,而那笔钱从未被扣过(可反复下单-支付-取消刷余额)。
 * Phase 2a 修好后该断言已**翻转**为期望行为,现在是防回归的网,而不是缺陷存证。
 *
 * 注:{@code @Transactional} 测试基类使每个方法整体回滚,所以这里只能证明单线程下的行为;
 * 并发下的「只退一次」由 {@code OrderCancelConcurrencyTest} 覆盖(它不能用回滚基类)。
 */
class OrderCancelCharacterizationTest extends BaseControllerTest {

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private PaymentMapper paymentMapper;

    @Autowired
    private ProductOrderMapper productOrderMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ProductOrderService productOrderService;

    @Autowired
    private OrderTimeoutTask orderTimeoutTask;

    // ─────────────────────────── 当前缺陷(Phase 2 必须翻转) ───────────────────────────

    @Test
    @DisplayName("card 支付后取消订单:退款不回余额(那笔钱从未被扣过)")
    void cardPaidCancelDoesNotCreditBalance() throws Exception {
        String token = userToken();
        BigDecimal balanceBefore = userMapper.selectById(1).getBalance();

        // 走模拟银行卡网关:create + confirm(card) 全程不触碰 balance
        String orderNo = createPendingOrder(token, 1, 1);
        confirm(token, orderNo, "card");
        assertEquals("待发货", rowStatus(orderNo), "card 支付后订单应推进到待发货");

        BigDecimal balanceAfterConfirm = userMapper.selectById(1).getBalance();
        assertEquals(0, balanceBefore.compareTo(balanceAfterConfirm),
                "card 渠道确认支付不应改动余额(所以退款也不该进余额)");

        BigDecimal paid = rowTotalMoney(orderNo);
        assertTrue(paid.signum() > 0, "订单金额应为正数,否则本测试无法证明'没进余额'");

        post("/orders/" + orderNo + "/cancel", token, Map.of())
                .andExpect(status().isOk());

        assertEquals(0, balanceAfterConfirm.compareTo(userMapper.selectById(1).getBalance()),
                "card 渠道的退款应回原渠道、不进余额钱包。此前会凭空增加 " + paid
                        + ",且可反复下单-支付-取消刷余额");
        assertEquals("已取消", rowStatus(orderNo));
        assertEquals("已退款", paymentMapper.selectByOrderNo(orderNo).getStatus(),
                "退款去向是原渠道,体现为支付单置已退款");
    }

    // ─────────────────────────── 已正确的行为(Phase 2 必须保持) ───────────────────────────

    @Test
    @DisplayName("余额支付后取消:余额被扣再加回,净变化为零(与 card 路径形成对照)")
    void balancePaidCancelIsNetZero() throws Exception {
        String token = userToken();
        // 先给测试用户一笔余额,否则 consumption 会因「余额不足」拒绝
        userMapper.addBalance(1, BigDecimal.valueOf(1000));
        BigDecimal balanceBefore = userMapper.selectById(1).getBalance();

        String orderNo = createPendingOrder(token, 1, 1);
        BigDecimal paid = rowTotalMoney(orderNo);

        confirm(token, orderNo, "balance");
        assertEquals("待发货", rowStatus(orderNo));
        assertEquals("balance", paymentMapper.selectByOrderNo(orderNo).getChannel(),
                "confirm 时的实际渠道必须落库 —— 建单给的是 card,confirm 用了 balance,"
                        + "若不同步写回,payment.channel 会与实际扣款渠道不符,取消时就会退错去向");
        assertEquals(0, balanceBefore.subtract(paid).compareTo(userMapper.selectById(1).getBalance()),
                "balance 渠道确认支付应扣减余额");

        post("/orders/" + orderNo + "/cancel", token, Map.of())
                .andExpect(status().isOk());

        assertEquals(0, balanceBefore.compareTo(userMapper.selectById(1).getBalance()),
                "余额支付取消后净变化应为零 —— balance 路径本来就是自洽的,错的是 card 路径");
        assertEquals("已退款", paymentMapper.selectByOrderNo(orderNo).getStatus());
    }

    @Test
    @DisplayName("取消待支付订单:回补库存 + 支付单转已取消(不涉及退款)")
    void cancelPendingOrderRestoresStockAndClosesPayment() throws Exception {
        String token = userToken();
        BigDecimal balanceBefore = userMapper.selectById(1).getBalance();
        int stockBefore = productMapper.selectById(1).getStock();

        String orderNo = createPendingOrder(token, 1, 2);
        assertEquals(stockBefore - 2, productMapper.selectById(1).getStock(), "下单应扣减库存");
        assertEquals("待支付", paymentMapper.selectByOrderNo(orderNo).getStatus());

        post("/orders/" + orderNo + "/cancel", token, Map.of())
                .andExpect(status().isOk());

        assertEquals("已取消", rowStatus(orderNo), "待支付订单取消后应转已取消");
        assertEquals(stockBefore, productMapper.selectById(1).getStock(), "取消后库存应回补到原值");
        assertEquals("已取消", paymentMapper.selectByOrderNo(orderNo).getStatus(),
                "待支付支付单应转已取消(而非已退款)");
        assertEquals(0, balanceBefore.compareTo(userMapper.selectById(1).getBalance()),
                "待支付订单未付过款,取消不应改动余额");
    }

    @Test
    @DisplayName("取消幂等:重复取消不再退款、不再回补库存")
    void cancelIsIdempotent() throws Exception {
        String token = userToken();
        String orderNo = createPendingOrder(token, 1, 1);
        confirm(token, orderNo, "card");

        post("/orders/" + orderNo + "/cancel", token, Map.of()).andExpect(status().isOk());
        int stockAfterFirst = productMapper.selectById(1).getStock();
        BigDecimal balanceAfterFirst = userMapper.selectById(1).getBalance();

        // 第二次取消:所有行都已非「待支付/待发货」→ cancelRows 的 anyActive 判定直接返回
        post("/orders/" + orderNo + "/cancel", token, Map.of()).andExpect(status().isOk());

        assertEquals(stockAfterFirst, productMapper.selectById(1).getStock(), "重复取消不应再次回补库存");
        assertEquals(0, balanceAfterFirst.compareTo(userMapper.selectById(1).getBalance()),
                "重复取消不应再次退款");
    }

    // ─────────────────────────── 超时任务路径 ───────────────────────────

    @Test
    @DisplayName("超时取消(任务接口直调):回补库存 + 支付单转已超时 + 幂等")
    void timeoutCancelRestoresStockAndIsIdempotent() throws Exception {
        String token = userToken();
        int stockBefore = productMapper.selectById(1).getStock();
        String orderNo = createPendingOrder(token, 1, 1);

        productOrderService.cancelTimeoutOrder(orderNo);

        assertEquals("已取消", rowStatus(orderNo));
        assertEquals(stockBefore, productMapper.selectById(1).getStock(), "超时取消应回补库存");
        assertEquals("已超时", paymentMapper.selectByOrderNo(orderNo).getStatus(),
                "待支付支付单应转已超时(而非已取消)");

        // 重复调用:anyActive 判定使其成为空操作
        int stockAfterFirst = productMapper.selectById(1).getStock();
        productOrderService.cancelTimeoutOrder(orderNo);
        assertEquals(stockAfterFirst, productMapper.selectById(1).getStock(),
                "重复超时取消不应再次回补库存");
    }

    @Test
    @DisplayName("超时任务:create_time 回拨超过 30 分钟后被扫描到并取消")
    void timeoutTaskPicksUpOrdersPastCutoff() throws Exception {
        String token = userToken();
        int stockBefore = productMapper.selectById(1).getStock();
        String orderNo = createPendingOrder(token, 1, 1);

        // 回拨 create_time 使其超过 30 分钟阈值
        backdate(orderNo, LocalDateTime.now().minusMinutes(31));

        orderTimeoutTask.cancelTimedOutOrders();

        assertEquals("已取消", rowStatus(orderNo), "超过 30 分钟的待支付订单应被任务取消");
        assertEquals(stockBefore, productMapper.selectById(1).getStock(), "任务取消应回补库存");
        assertEquals("已超时", paymentMapper.selectByOrderNo(orderNo).getStatus());
    }

    // ─────────────────────────── 商家端取消(第三条入口) ───────────────────────────

    @Test
    @DisplayName("商家端取消订单:委派到统一取消逻辑 —— 回补库存、支付单退款、card 渠道不动余额")
    void merchantCancelDelegatesToUnifiedLogic() throws Exception {
        int stockBefore = productMapper.selectById(1).getStock();
        BigDecimal balanceBefore = userMapper.selectById(1).getBalance();

        String orderNo = createPendingOrder(userToken(), 1, 2);
        confirm(userToken(), orderNo, "card");           // → 待发货
        int rowId = productOrderMapper.selectByOrderNo(orderNo).get(0).getId();

        // shopToken() 的 id=1,而商品 1 属于 shop 1,故归属校验通过
        put("/merchant/orders/" + rowId + "/status", shopToken(), Map.of("status", "cancelled"))
                .andExpect(status().isOk());

        assertEquals("已取消", rowStatus(orderNo));
        assertEquals(stockBefore, productMapper.selectById(1).getStock(),
                "商家端取消也必须回补库存 —— 此前只改 status,库存永不回补");
        assertEquals("已退款", paymentMapper.selectByOrderNo(orderNo).getStatus(),
                "支付单必须被推进 —— 此前完全不动");
        assertEquals(0, balanceBefore.compareTo(userMapper.selectById(1).getBalance()),
                "card 渠道:退款不回余额(与前台同一套渠道规则)");
    }

    // ─────────────────────────── 超时扫描的批量上限 ───────────────────────────

    @Test
    @DisplayName("超时扫描带 LIMIT:上限足够时全返回,上限不足时只返回该数量")
    void pendingScanIsBoundedByLimit() throws Exception {
        for (int i = 0; i < 3; i++) {
            String orderNo = createPendingOrder(userToken(), 1, 1);
            backdate(orderNo, LocalDateTime.now().minusMinutes(60));
        }
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);

        assertEquals(3, productOrderMapper.selectPendingBefore(cutoff, 100).size(),
                "上限足够时应返回全部 3 笔超时订单");
        assertEquals(2, productOrderMapper.selectPendingBefore(cutoff, 2).size(),
                "LIMIT 必须生效 —— 此前无上限,超时订单一多会一次性载入内存");
    }

    // ─────────────────────────── helpers ───────────────────────────

    /** 把该 orderNo 分组的 create_time 回拨 —— updateById 的 <set> 里含 create_time,无需裸 SQL */
    private void backdate(String orderNo, LocalDateTime when) {
        for (ProductOrder row : productOrderMapper.selectByOrderNo(orderNo)) {
            row.setCreateTime(when);
            productOrderMapper.updateById(row);
        }
    }

    /** POST /payments/create 建一笔待支付订单,返回 orderNo */
    private String createPendingOrder(String token, int productId, int qty) throws Exception {
        Map<String, Object> body = Map.of(
                "items", List.of(Map.of("id", productId, "quantity", qty)),
                "channel", "card"
        );
        MvcResult result = post("/payments/create", token, body)
                .andExpect(status().isOk())
                .andReturn();
        JSONObject json = JSONObject.parseObject(
                result.getResponse().getContentAsString(StandardCharsets.UTF_8));
        String orderNo = json.getJSONObject("data").getString("orderId");
        assertNotNull(orderNo, "下单应返回 orderNo");
        return orderNo;
    }

    private void confirm(String token, String orderNo, String channel) throws Exception {
        post("/payments/confirm", token, Map.of("orderId", orderNo, "channel", channel))
                .andExpect(status().isOk());
    }

    /** 取该 orderNo 分组的状态,并断言同组各行状态一致 */
    private String rowStatus(String orderNo) {
        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        assertFalse(rows.isEmpty(), "订单分组不应为空: " + orderNo);
        for (ProductOrder row : rows) {
            assertEquals(rows.get(0).getStatus(), row.getStatus(),
                    "同一 orderNo 的订单行状态应一致");
        }
        return rows.get(0).getStatus();
    }

    private BigDecimal rowTotalMoney(String orderNo) {
        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        assertFalse(rows.isEmpty());
        return rows.get(0).getTotalMoney();
    }
}
