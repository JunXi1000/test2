package com.project.platform.task;

import com.project.platform.entity.ProductOrder;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.service.ProductOrderService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 待支付订单超时自动取消(Phase 2)。
 * 「创建支付单」与「确认支付」之间的崩溃/放弃窗口由 30 分钟兜底:超时后回补库存、支付单置已超时。
 * 每 60s 扫描一次;逐个 order_no 取消,try/catch 保证单个失败不中断整体扫描。
 */
@Component
@Slf4j
public class OrderTimeoutTask {

    /** 待支付超时分钟数 */
    private static final int TIMEOUT_MINUTES = 30;

    @Resource
    private ProductOrderMapper productOrderMapper;

    @Resource
    private ProductOrderService productOrderService;

    @Scheduled(fixedDelay = 60_000)
    public void cancelTimedOutOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(TIMEOUT_MINUTES);
        List<ProductOrder> pending = productOrderMapper.selectPendingBefore(cutoff);
        if (pending.isEmpty()) {
            return;
        }
        List<String> orderNos = pending.stream()
                .map(ProductOrder::getOrderNo)
                .filter(n -> n != null && !n.isEmpty())
                .distinct()
                .toList();
        for (String orderNo : orderNos) {
            try {
                productOrderService.cancelTimeoutOrder(orderNo);
            } catch (Exception e) {
                log.warn("超时取消订单 {} 失败:{}", orderNo, e.getMessage(), e);
            }
        }
    }
}
