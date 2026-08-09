package com.project.platform.controller;

import com.project.platform.entity.ProductOrder;
import com.project.platform.service.ProductOrderService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Storefront order API — matches frontend's expected /orders contract.
 */
@RestController
@RequestMapping("/orders")
public class StorefrontOrderController {

    @Resource
    private ProductOrderService productOrderService;

    /**
     * GET /orders — user's orders
     */
    @GetMapping
    public ResponseVO<List<ProductOrder>> getOrders(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "50") Integer pageSize) {
        Map<String, Object> query = new HashMap<>();
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        if ("USER".equals(CurrentUserThreadLocal.getCurrentUser().getType())) {
            query.put("userId", userId);
        }
        PageVO<ProductOrder> pageVO = productOrderService.page(query, page, pageSize);
        return ResponseVO.ok(pageVO.getList());
    }

    /**
     * GET /orders/recent — most recent orders
     */
    @GetMapping("/recent")
    public ResponseVO<List<ProductOrder>> getRecentOrders() {
        Map<String, Object> query = new HashMap<>();
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        if ("USER".equals(CurrentUserThreadLocal.getCurrentUser().getType())) {
            query.put("userId", userId);
        }
        PageVO<ProductOrder> pageVO = productOrderService.page(query, 1, 5);
        return ResponseVO.ok(pageVO.getList());
    }
}
