package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.ReturnRequest;
import com.project.platform.service.ReturnRequestService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 退换货 API — matches frontend's expected /returns contract.
 */
@RestController
@RequestMapping("/returns")
public class ReturnRequestController {

    @Resource
    private ReturnRequestService returnRequestService;

    @GetMapping("")
    public ResponseVO<List<Map<String, Object>>> getReturns() {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        List<Map<String, Object>> result = new ArrayList<>();
        for (ReturnRequest r : returnRequestService.getByUserId(userId)) {
            result.add(toMap(r));
        }
        return ResponseVO.ok(result);
    }

    @PostMapping("")
    public ResponseVO<Map<String, Object>> create(@RequestBody JSONObject body) {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        ReturnRequest req = new ReturnRequest();
        req.setUserId(userId);
        req.setOrderId(body.getString("orderId"));
        req.setProductTitle(body.getString("productTitle"));
        req.setProductImage(body.getString("productImage"));
        req.setReason(body.getString("reason"));
        req.setDetail(body.getString("detail"));
        Double amount = body.getDouble("refundAmount");
        req.setRefundAmount(amount == null ? 0D : amount);
        return ResponseVO.ok(toMap(returnRequestService.create(req)));
    }

    private Map<String, Object> toMap(ReturnRequest r) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", String.valueOf(r.getId()));
        m.put("orderId", r.getOrderId());
        m.put("productTitle", r.getProductTitle());
        m.put("productImage", r.getProductImage());
        m.put("reason", r.getReason());
        m.put("detail", r.getDetail());
        m.put("status", r.getStatus());
        m.put("refundAmount", r.getRefundAmount());
        m.put("createdAt", toEpochMilli(r.getCreatedTime()));
        m.put("updatedAt", toEpochMilli(r.getUpdatedTime()));
        return m;
    }

    private Long toEpochMilli(LocalDateTime t) {
        return t == null ? null : t.toInstant(ZoneOffset.UTC).toEpochMilli();
    }
}
