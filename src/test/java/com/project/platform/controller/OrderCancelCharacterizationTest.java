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
 * 取消订单的**特性化测试**(characterization test)—— 钉住重构前的真实行为,不是目标态。
 *
 * 覆盖两条入口,它们复用同一段跨表写逻辑 {@code ProductOrderServiceImpl.cancelRows}:
 * <ul>
 *   <li>用户手动取消:{@code POST /orders/{orderNo}/cancel} → {@code cancelByOrderNo}(**有** {@code @Transactional})</li>
 *   <li>超时自动取消:{@code OrderTimeoutTask} → {@code cancelTimeoutOrder}(**无** {@code @Transactional})</li>
 * </ul>
 *
 * 本类里有两条测试**断言的是缺陷而不是期望行为**,各自用 {@code @DisplayName} 标了
 * 「当前缺陷」前缀。Phase 2 修好后必须把它们翻转为期望行为 —— 这是刻意为之,
 * 让修复的 diff 自解释。
 *
 * 注:{@code @Transactional} 测试基类使每个方法整体回滚,所以这里只能证明单线程下的
 * 行为,证明不了并发下的隔离性(那需要 Phase 2e 的非回滚测试基类)。
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
    @DisplayName("当前缺陷:card 支付后取消订单会凭空增加余额(钱从未被扣过)")
    void cardPaidCancelCreatesBalanceOutOfNothing() throws Exception {
        String token = userToken();
        BigDecimal balanceBefore = userMapper.selectById(1).getBalance();

        // 走模拟银行卡网关:create + confirm(card) 全程不触碰 balance
        String orderNo = createPendingOrder(token, 1, 1);
        confirm(token, orderNo, "card");
        assertEquals("待发货", rowStatus(orderNo), "card 支付后订单应推进到待发货");

        BigDecimal balanceAfterConfirm = userMapper.selectById(1).getBalance();
        assertEquals(0, balanceBefore.compareTo(balanceAfterConfirm),
                "card 渠道确认支付不应改动余额(这是缺陷的成因,不是期望行为)");

        BigDecimal paid = rowTotalMoney(orderNo);

        // 取消 → 当前实现按「待发货即退款」往余额里加钱
        post("/orders/" + orderNo + "/cancel", token, Map.of())
                .andExpect(status().isOk());

        BigDecimal balanceAfterCancel = userMapper.selectById(1).getBalance();
        assertEquals(0, balanceAfterConfirm.add(paid).compareTo(balanceAfterCancel),
                "当前缺陷:取消一笔 card 支付的订单把 " + paid + " 充进了余额钱包,而这笔钱从未被扣过");
        assertEquals("已退款", paymentMapper.selectByOrderNo(orderNo).getStatus(),
                "支付单当前被置为已退款(但退款去向是站内余额,不是原渠道)");
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

        // 回拨 create_time —— updateById 的 <set> 里包含 create_time,故无需裸 SQL
        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        LocalDateTime backdated = LocalDateTime.now().minusMinutes(31);
        for (ProductOrder row : rows) {
            row.setCreateTime(backdated);
            productOrderMapper.updateById(row);
        }

        orderTimeoutTask.cancelTimedOutOrders();

        assertEquals("已取消", rowStatus(orderNo), "超过 30 分钟的待支付订单应被任务取消");
        assertEquals(stockBefore, productMapper.selectById(1).getStock(), "任务取消应回补库存");
        assertEquals("已超时", paymentMapper.selectByOrderNo(orderNo).getStatus());
    }

    // ─────────────────────────── helpers ───────────────────────────

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
