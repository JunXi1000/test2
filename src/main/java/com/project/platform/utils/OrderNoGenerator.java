package com.project.platform.utils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 订单号生成:"NO" + yyyyMMddHHmmss + 4 位随机,
 * 如 NO202608251015310427。同一结算批次共享一个 order_no,
 * payment.order_no 唯一索引兜底并发冲突。
 */
public final class OrderNoGenerator {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private OrderNoGenerator() {
    }

    public static String next() {
        return "NO" + LocalDateTime.now().format(FMT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10_000));
    }
}
