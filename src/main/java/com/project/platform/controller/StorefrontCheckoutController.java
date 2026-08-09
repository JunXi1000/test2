package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.Product;
import com.project.platform.service.CouponService;
import com.project.platform.service.ProductService;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Checkout API — matches frontend's expected /checkout contract.
 */
@RestController
@RequestMapping("/checkout")
public class StorefrontCheckoutController {

    @Resource
    private ProductService productService;

    @Resource
    private CouponService couponService;

    @PostMapping("/summary")
    public ResponseVO<Map<String, Object>> calculateSummary(@RequestBody JSONObject body) {
        double subtotal = 0;
        var items = body.getJSONArray("items");
        if (items != null) {
            for (int i = 0; i < items.size(); i++) {
                var item = items.getJSONObject(i);
                double price = item.getDoubleValue("price");
                int qty = item.getIntValue("quantity");
                subtotal += price * qty;
            }
        }
        double shipping = subtotal > 200 ? 0 : 12;
        double tax = Math.round(subtotal * 0.08 * 100.0) / 100.0;
        double total = subtotal + shipping + tax;

        Map<String, Object> result = new HashMap<>();
        result.put("subtotal", subtotal);
        result.put("shipping", shipping);
        result.put("tax", tax);
        result.put("discount", 0);
        result.put("total", total);
        return ResponseVO.ok(result);
    }

    @PostMapping("/promo")
    public ResponseVO<Map<String, Object>> applyPromo(@RequestBody JSONObject body) {
        String code = body.getString("code");
        double subtotal = body.getDoubleValue("subtotal");

        Map<String, Object> result = new HashMap<>();
        // 1) 优先从 coupon 表校验(Phase 1 后端化)
        Map<String, Object> couponResult = couponService.applyByCode(code, subtotal);
        if (couponResult != null) {
            result.put("discount", couponResult.get("discount"));
            result.put("couponId", code);
            return ResponseVO.ok(result);
        }
        // 2) 回退到旧的硬编码优惠码(兼容遗留 mock 码)
        Map<String, Double> promos = Map.of("SAVE10", 0.10, "VIP15", 0.15);
        double rate = promos.getOrDefault(code.toUpperCase(), 0.0);
        result.put("discount", Math.round(subtotal * rate * 100.0) / 100.0);
        return ResponseVO.ok(result);
    }
}
