package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.dto.StorefrontCheckoutDTO;
import com.project.platform.service.PaymentService;
import com.project.platform.service.ProductOrderService;
import com.project.platform.vo.ResponseVO;
import com.project.platform.vo.StorefrontCheckoutResult;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Payment API — matches frontend's expected /payments contract.
 *
 * ⚠️ 模拟网关(非真实):订单/支付记录**真实落库**、库存**真实扣减**,
 * 但不存在真实商户号与回调验签。接入微信/支付宝时必须替换为
 * 「网关下单 + 回调验签 + 幂等入账」,并移除本页的三个方法。
 */
@RestController
@RequestMapping("/payments")
public class StorefrontPaymentController {

    @Resource
    private ProductOrderService productOrderService;

    @Resource
    private PaymentService paymentService;

    /**
     * POST /payments/create — 结算下单并创建支付单(模拟网关)。
     * 真实创建订单行 + 支付单,原子扣库存;orderNo 同时充当 paymentId/orderId。
     */
    @PostMapping("/create")
    public ResponseVO<Map<String, Object>> createPayment(@RequestBody StorefrontCheckoutDTO dto) {
        StorefrontCheckoutResult result = productOrderService.createStorefrontOrder(dto);
        Map<String, Object> map = new HashMap<>();
        map.put("paymentId", result.getOrderNo());
        map.put("orderId", result.getOrderNo());
        map.put("clientSecret", null); // 模拟网关无真实 client_secret
        map.put("amount", result.getAmount());
        return ResponseVO.ok(map);
    }

    /**
     * POST /payments/confirm — 确认支付。
     * 前端以 paymentId 携带 orderNo;channel 缺省读支付单记录。
     * 幂等:支付单已支付时直接返回 succeeded,不重复扣款。
     */
    @PostMapping("/confirm")
    public ResponseVO<Map<String, Object>> confirmPayment(@RequestBody JSONObject body) {
        String orderNo = body.getString("orderId");
        if (orderNo == null || orderNo.isEmpty()) {
            orderNo = body.getString("paymentId");
        }
        paymentService.confirm(orderNo, body.getString("channel"));
        Map<String, Object> result = new HashMap<>();
        result.put("status", "succeeded");
        result.put("orderId", orderNo);
        return ResponseVO.ok(result);
    }

    /**
     * POST /payments/complete-action — 3DS 认证完成后的银行回调。
     * 读支付单 channel 转调 confirm,与 confirm 同语义(幂等)。
     */
    @PostMapping("/complete-action")
    public ResponseVO<Map<String, Object>> completeAction(@RequestBody JSONObject body) {
        String orderNo = body.getString("paymentId");
        if (orderNo == null || orderNo.isEmpty()) {
            orderNo = body.getString("orderId");
        }
        paymentService.complete(orderNo);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "succeeded");
        result.put("orderId", orderNo);
        return ResponseVO.ok(result);
    }
}
