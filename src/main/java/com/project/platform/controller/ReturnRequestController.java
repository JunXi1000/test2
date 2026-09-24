package com.project.platform.controller;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.ReturnRequestCreateDTO;
import com.project.platform.entity.ProductOrder;
import com.project.platform.entity.ReturnRequest;
import com.project.platform.service.ProductOrderService;
import com.project.platform.service.ReturnRequestService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 退换货 API — matches frontend's expected /returns contract.
 */
@RestController
@RequestMapping("/returns")
public class ReturnRequestController {

    @Resource
    private ReturnRequestService returnRequestService;

    @Resource
    private ProductOrderService productOrderService;

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
    public ResponseVO<Map<String, Object>> create(@RequestBody ReturnRequestCreateDTO body) {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        // 归属校验:orderId 必须是**当前用户自己的**订单(不存在 404 / 非本人 403)。
        // 此前 orderId 完全不校验 —— 任何登录用户都能为他人订单提退货申请。
        List<ProductOrder> rows = productOrderService.listOwnedOrderRows(body.getOrderId());

        ReturnRequest req = new ReturnRequest();
        req.setUserId(current.getId());
        req.setOrderId(body.getOrderId());
        req.setProductTitle(body.getProductTitle());
        req.setProductImage(body.getProductImage());
        req.setReason(body.getReason());
        req.setDetail(body.getDetail());
        req.setRefundAmount(resolveRefundAmount(body.getRefundAmount(), rows));
        return ResponseVO.ok(toMap(returnRequestService.create(req)));
    }

    /**
     * 退款金额以**该订单实付金额**为上限(服务端算),客户端可在此之内指定(支持部分退货)。
     * 此前完全采信客户端传值,虚报多少就存多少。
     *
     * <p>取值规则:客户端给的正数 → 与实付金额取小;未给/非正 → 取实付金额。
     */
    private BigDecimal resolveRefundAmount(BigDecimal requested, List<ProductOrder> rows) {
        BigDecimal paid = rows.stream()
                .map(ProductOrder::getTotalMoney)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (requested == null || requested.signum() <= 0) {
            return paid;
        }
        return requested.min(paid);
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
