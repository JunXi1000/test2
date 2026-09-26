package com.project.platform.controller;

import com.project.platform.dto.CheckoutPromoDTO;
import com.project.platform.dto.CheckoutSummaryDTO;
import com.project.platform.entity.Product;
import com.project.platform.exception.CustomException;
import com.project.platform.service.CouponService;
import com.project.platform.service.ProductService;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
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
    public ResponseVO<Map<String, Object>> calculateSummary(@RequestBody CheckoutSummaryDTO body) {
        BigDecimal[] tierThresholds = {new BigDecimal("100"), new BigDecimal("200"), new BigDecimal("300")};
        BigDecimal[] tierDiscounts = {new BigDecimal("10"), new BigDecimal("30"), new BigDecimal("60")};

        BigDecimal subtotal = BigDecimal.ZERO;
        List<CheckoutSummaryDTO.Item> items = body.getItems();
        // 空/缺 items 此前会静默按 subtotal=0 返回 200 —— 一个"合法"的零元结算摘要。
        // 按常规做法:没有商品就没有结算可言,直接 400。
        if (items == null || items.isEmpty()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "结算商品不能为空");
        }
        {
            for (CheckoutSummaryDTO.Item item : items) {
                // 兼容前端 CartItem:productId 优先,缺省回落 id(DTO 里 resolveProductId 封装同一规则)
                Integer productId = item.resolveProductId();
                Integer qty = item.getQuantity();
                // 原实现用 getIntValue 读数量(缺失得 0),故「缺失」与「<=0」同样拒绝
                if (productId == null || qty == null || qty <= 0) {
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
    public ResponseVO<Map<String, Object>> applyPromo(@RequestBody CheckoutPromoDTO body) {
        String code = body.getCode();
        BigDecimal subtotal = body.getSubtotal();
        // 缺 code 时原实现会在下面的 code.toUpperCase() 抛 NPE → 500。请求不合法应当是 400。
        // 注:同方法内另两处校验用的是 CustomException 默认的 409,语义上同样偏了,
        // 属既有的错误码不一致,未纳入本次改动范围。
        if (code == null || code.isBlank()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "优惠码不能为空");
        }
        // 同理:subtotal 缺失时下游(applyByCode 的乘法与回退分支)会 NPE → 500。
        // 两条路径都要用它算折扣,故它是真正的必填项。
        if (subtotal == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "结算金额不能为空");
        }

        Map<String, Object> result = new HashMap<>();
        // 1) 优先从 coupon 表校验(Phase 1 后端化)
        Map<String, Object> couponResult = couponService.applyByCode(code, subtotal);
        if (couponResult != null) {
            result.put("discount", couponResult.get("discount"));
            result.put("couponId", code);
            return ResponseVO.ok(result);
        }
        // 2) 回退到旧的硬编码优惠码(兼容遗留 mock 码)
        Map<String, BigDecimal> promos = Map.of(
                "SAVE10", new BigDecimal("0.10"),
                "VIP15", new BigDecimal("0.15"));
        BigDecimal rate = promos.getOrDefault(code.toUpperCase(), BigDecimal.ZERO);
        result.put("discount", subtotal.multiply(rate).setScale(2, RoundingMode.HALF_UP));
        return ResponseVO.ok(result);
    }
}
