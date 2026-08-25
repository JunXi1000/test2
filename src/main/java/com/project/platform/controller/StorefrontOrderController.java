package com.project.platform.controller;

import com.project.platform.service.ProductOrderService;
import com.project.platform.vo.ResponseVO;
import com.project.platform.vo.StorefrontOrderVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Storefront order API — matches frontend's expected /orders contract.
 * Phase 2:返回按 order_no 聚合的分组订单(旧行各自成组)。
 */
@RestController
@RequestMapping("/orders")
public class StorefrontOrderController {

    @Resource
    private ProductOrderService productOrderService;

    /**
     * GET /orders — user's orders (grouped by order_no, descending by createTime)
     */
    @GetMapping
    public ResponseVO<List<StorefrontOrderVO>> getOrders(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "50") Integer pageSize) {
        return ResponseVO.ok(productOrderService.listStorefrontOrders(page, pageSize));
    }

    /**
     * GET /orders/recent — most recent orders
     */
    @GetMapping("/recent")
    public ResponseVO<List<StorefrontOrderVO>> getRecentOrders() {
        return ResponseVO.ok(productOrderService.listStorefrontOrders(1, 5));
    }

    /**
     * POST /orders/{orderNo}/cancel — cancel a pending/unshipped order group
     * (回补库存 + 已付款退款 + 支付单推进,幂等)
     */
    @PostMapping("/{orderNo}/cancel")
    public ResponseVO<Void> cancelOrder(@PathVariable String orderNo) {
        productOrderService.cancelByOrderNo(orderNo);
        return ResponseVO.ok(null);
    }
}
