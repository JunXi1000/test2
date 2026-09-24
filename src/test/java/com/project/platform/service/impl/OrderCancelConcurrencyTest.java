package com.project.platform.service.impl;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.Payment;
import com.project.platform.entity.ProductOrder;
import com.project.platform.mapper.PaymentMapper;
import com.project.platform.mapper.ProductMapper;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.mapper.UserMapper;
import com.project.platform.service.ProductOrderService;
import com.project.platform.utils.CurrentUserThreadLocal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * 取消订单的**并发**回归网。
 *
 * <p>存在的理由:{@code ProductOrderServiceImpl.cancelRows} 的幂等判断曾经是「先读行状态 → 判断
 * → 再写」,在无锁、且 {@code cancelTimeoutOrder} 没有事务的情况下,用户手动取消与超时任务
 * 可以**同时通过判断**,导致同一笔钱退两次、库存回补两次。修复手段是把状态推进改成条件 UPDATE
 * 抢占行所有权。本类用真并发证明「只生效一次」。
 *
 * <p><b>刻意不继承 {@code BaseControllerTest}</b>:那个基类带 {@code @Transactional}(逐方法回滚),
 * 而回滚语义下两个线程互相看不见对方的写入,根本构不成竞态。所以本类**真的提交数据**,
 * 并在 {@link #cleanup()} 里用 {@link JdbcTemplate} 精确还原。
 * 注解与基类保持一致,以便**复用同一个 Spring 上下文**(种子脚本不是幂等的,多一个上下文会重复插入)。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderCancelConcurrencyTest {

    private static final String ORDER_NO = "RACE-TEST-0001";
    private static final int USER_ID = 1;
    private static final int PRODUCT_ID = 1;
    private static final int QTY = 2;
    private static final BigDecimal AMOUNT = new BigDecimal("50.00");

    @Autowired
    private ProductOrderService productOrderService;

    @Autowired
    private ProductOrderMapper productOrderMapper;

    @Autowired
    private PaymentMapper paymentMapper;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private BigDecimal balanceSnapshot;
    private Integer stockSnapshot;
    private Integer salesVolumeSnapshot;

    @AfterEach
    void cleanup() {
        jdbcTemplate.update("DELETE FROM product_order WHERE order_no = ?", ORDER_NO);
        jdbcTemplate.update("DELETE FROM payment WHERE order_no = ?", ORDER_NO);
        if (balanceSnapshot != null) {
            jdbcTemplate.update("UPDATE user SET balance = ? WHERE id = ?", balanceSnapshot, USER_ID);
        }
        if (stockSnapshot != null && salesVolumeSnapshot != null) {
            jdbcTemplate.update("UPDATE product SET stock = ?, sales_volume = ? WHERE id = ?",
                    stockSnapshot, salesVolumeSnapshot, PRODUCT_ID);
        }
        CurrentUserThreadLocal.clear();
    }

    @Test
    @DisplayName("并发:用户取消与超时任务同时作用于同一订单,只退一次款、只回补一次库存")
    void concurrentCancelTakesEffectOnlyOnce() throws Exception {
        seedPaidOrder();
        balanceSnapshot = userMapper.selectById(USER_ID).getBalance();
        stockSnapshot = productMapper.selectById(PRODUCT_ID).getStock();
        salesVolumeSnapshot = productMapper.selectById(PRODUCT_ID).getSalesVolume();

        // 两个执行流尽量对齐到同一瞬间发起取消
        CyclicBarrier barrier = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> userCancel = pool.submit(() -> {
                CurrentUserThreadLocal.set(user(USER_ID));
                awaitQuietly(barrier);
                productOrderService.cancelByOrderNo(ORDER_NO);
                return null;
            });
            Future<?> timeoutCancel = pool.submit(() -> {
                awaitQuietly(barrier);
                productOrderService.cancelTimeoutOrder(ORDER_NO);
                return null;
            });
            userCancel.get(15, TimeUnit.SECONDS);
            timeoutCancel.get(15, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
            CurrentUserThreadLocal.clear();
        }

        BigDecimal balanceAfter = userMapper.selectById(USER_ID).getBalance();
        assertEquals(0, balanceSnapshot.add(AMOUNT).compareTo(balanceAfter),
                "余额渠道的退款只能发生一次 —— 并发双退会让余额多出 " + AMOUNT
                        + "(修复前:先读后判的竞态让两条执行流都通过判断)");
        assertEquals(stockSnapshot + QTY, productMapper.selectById(PRODUCT_ID).getStock(),
                "库存只能回补一次");
        assertEquals("已取消", productOrderMapper.selectByOrderNo(ORDER_NO).get(0).getStatus());
    }

    @Test
    @DisplayName("串行重复取消也只生效一次(幂等)")
    void repeatedCancelTakesEffectOnlyOnce() throws Exception {
        seedPaidOrder();
        balanceSnapshot = userMapper.selectById(USER_ID).getBalance();
        stockSnapshot = productMapper.selectById(PRODUCT_ID).getStock();
        salesVolumeSnapshot = productMapper.selectById(PRODUCT_ID).getSalesVolume();

        CurrentUserThreadLocal.set(user(USER_ID));
        productOrderService.cancelByOrderNo(ORDER_NO);
        productOrderService.cancelTimeoutOrder(ORDER_NO);
        productOrderService.cancelTimeoutOrder(ORDER_NO);
        CurrentUserThreadLocal.clear();

        assertEquals(0, balanceSnapshot.add(AMOUNT).compareTo(userMapper.selectById(USER_ID).getBalance()),
                "重复取消不应重复退款");
        assertEquals(stockSnapshot + QTY, productMapper.selectById(PRODUCT_ID).getStock(),
                "重复取消不应重复回补库存");
    }

    // ─────────────────────────── helpers ───────────────────────────

    /**
     * 造一笔「余额渠道、已支付、待发货」的订单 —— 这是会触发退款的状态。
     * 直接插表而不是走 HTTP,是为了不依赖下单链路,把这个测试聚焦在取消的并发语义上。
     */
    private void seedPaidOrder() {
        ProductOrder order = new ProductOrder();
        order.setOrderNo(ORDER_NO);
        order.setProductId(PRODUCT_ID);
        order.setShopId(1);
        order.setTotalMoney(AMOUNT);
        order.setQuantity(QTY);
        order.setUserId(USER_ID);
        order.setStatus("待发货");
        order.setCreateTime(LocalDateTime.now());
        assertEquals(1, productOrderMapper.insert(order));
        assertNotNull(order.getId(), "插入订单应回填 id");

        Payment payment = new Payment();
        payment.setOrderNo(ORDER_NO);
        payment.setUserId(USER_ID);
        payment.setAmount(AMOUNT);
        payment.setChannel("balance");
        payment.setStatus("已支付");
        payment.setCreateTime(LocalDateTime.now());
        assertEquals(1, paymentMapper.insert(payment));
    }

    private CurrentUserDTO user(int id) {
        CurrentUserDTO dto = new CurrentUserDTO();
        dto.setId(id);
        dto.setType("USER");
        dto.setUsername("user1");
        return dto;
    }

    private void awaitQuietly(CyclicBarrier barrier) {
        try {
            barrier.await(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new IllegalStateException("并发屏障等待失败", e);
        }
    }
}
