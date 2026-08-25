package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.Product;
import com.project.platform.exception.CustomException;
import com.project.platform.service.CouponService;
import com.project.platform.service.ProductService;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

    /**
     * 结算金额汇总(服务端校验)。
     * - 金额一律以 DB product.price 重算,绝不信任前端传入的 price;
     * - 满减档位与前端 DISCOUNT_TIERS 一致($100→$10 / $200→$30 / $300→$60);
     * - 限制:优惠/运费/税为**展示用**,不写入订单/支付金额(与钱包路径 totalMoney 保持一致)。
     */
    @PostMapping("/summary")
    public ResponseVO<Map<String, Object>> calculateSummary(@RequestBody JSONObject body) {
        BigDecimal[] tierThresholds = {new BigDecimal("100"), new BigDecimal("200"), new BigDecimal("300")};
        BigDecimal[] tierDiscounts = {new BigDecimal("10"), new BigDecimal("30"), new BigDecimal("60")};

        BigDecimal subtotal = BigDecimal.ZERO;
        var items = body.getJSONArray("items");
        if (items != null) {
            for (int i = 0; i < items.size(); i++) {
                var item = items.getJSONObject(i);
                // 兼容前端 CartItem:productId ?? id(cart store 的 id 即商品 id)
                Integer productId = item.getInteger("productId");
                if (productId == null) {
                    productId = item.getInteger("id");
                }
                int qty = item.getIntValue("quantity");
                if (productId == null || qty <= 0) {
                    throw new CustomException("结算商品参数不合法");
                }
                Product product = productService.selectById(productId);
                if (product == null) {
                    throw new CustomException("商品不存在或已下架");
                }
                subtotal = subtotal.add(product.getPrice().multiply(BigDecimal.valueOf(qty)));
            }
        }
        // 运费:满 200 免邮,否则 12
        BigDecimal shipping = subtotal.compareTo(new BigDecimal("200")) > 0 ? BigDecimal.ZERO : new BigDecimal("12");
        // 税:8%,四舍五入到分
        BigDecimal tax = subtotal.multiply(new BigDecimal("0.08")).setScale(2, RoundingMode.HALF_UP);
        // 满减(展示用):取已达标档中减免额最大的一档
        BigDecimal discount = BigDecimal.ZERO;
        for (int i = 0; i < tierThresholds.length; i++) {
            if (subtotal.compareTo(tierThresholds[i]) >= 0) {
                discount = tierDiscounts[i];
            }
        }
        BigDecimal total = subtotal.add(shipping).add(tax).subtract(discount);

        Map<String, Object> result = new HashMap<>();
        result.put("subtotal", subtotal.doubleValue());
        result.put("shipping", shipping.doubleValue());
        result.put("tax", tax.doubleValue());
        result.put("discount", discount.doubleValue());
        result.put("total", total.doubleValue());
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
