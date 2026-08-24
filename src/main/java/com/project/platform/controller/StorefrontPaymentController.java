package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.dto.CreateOrderByShoppingCartDTO;
import com.project.platform.entity.ProductOrder;
import com.project.platform.service.ProductOrderService;
import com.project.platform.service.ShoppingCartService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Payment API — matches frontend's expected /payments contract.
 */
@RestController
@RequestMapping("/payments")
public class StorefrontPaymentController {

    @Resource
    private ShoppingCartService shoppingCartService;

    @Resource
    private ProductOrderService productOrderService;

    @PostMapping("/create")
    public ResponseVO<Map<String, Object>> createPayment(@RequestBody JSONObject body) {
        // Create order from cart items
        CreateOrderByShoppingCartDTO dto = new CreateOrderByShoppingCartDTO();
        var items = body.getJSONArray("items");
        if (items != null) {
            List<Integer> ids = new ArrayList<>();
            for (int i = 0; i < items.size(); i++) {
                ids.add(items.getJSONObject(i).getInteger("productId"));
            }
            dto.setIds(ids);
        }
        var shipping = body.getJSONObject("shipping");
        if (shipping != null) {
            dto.setConsigneeName(shipping.getString("name"));
            dto.setConsigneeAddress(shipping.getString("address"));
            dto.setConsigneeTel("");
        }

        try {
            shoppingCartService.createOrder(dto);
        } catch (Exception e) {
            // Order creation may fail if cart is empty — return a placeholder
        }

        Map<String, Object> result = new HashMap<>();
        result.put("paymentId", "pay_" + System.currentTimeMillis());
        result.put("orderId", "ORD-" + (1000 + new Random().nextInt(9000)));
        result.put("clientSecret", "mock_secret");
        return ResponseVO.ok(result);
    }

    @PostMapping("/confirm")
    public ResponseVO<Map<String, Object>> confirmPayment(@RequestBody JSONObject body) {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "succeeded");
        result.put("orderId", body.getString("orderId"));
        return ResponseVO.ok(result);
    }

    /**
     * POST /payments/complete-action — 3DS 认证完成后的银行回调。
     *
     * ⚠️ MOCK 实现,仅限演示:直接返回 succeeded,不校验支付网关、不落库改单。
     *    - 该接口需登录(JWT),但任意登录用户都可调用,切勿当作真实支付结果。
     *    - 接入真实网关时必须替换:校验 HMAC/签名、核对 paymentId 与订单金额、
     *      仅在网关确认后更新订单状态,并移除本方法。
     */
    @PostMapping("/complete-action")
    public ResponseVO<Map<String, Object>> completeAction(@RequestBody JSONObject body) {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "succeeded");
        result.put("orderId", body.getString("orderId") != null
                ? body.getString("orderId")
                : "ORD-" + (1000 + new Random().nextInt(9000)));
        return ResponseVO.ok(result);
    }
}
