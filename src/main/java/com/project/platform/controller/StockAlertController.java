package com.project.platform.controller;

import com.project.platform.dto.StockAlertSubscribeDTO;
import com.project.platform.entity.StockAlert;
import com.project.platform.exception.CustomException;
import com.project.platform.service.StockAlertService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 到货订阅 API — matches frontend's expected /stock-alerts contract.
 */
@RestController
@RequestMapping("/stock-alerts")
public class StockAlertController {

    @Resource
    private StockAlertService stockAlertService;

    @GetMapping("/mine")
    public ResponseVO<List<Map<String, Object>>> getMine() {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        List<Map<String, Object>> result = new ArrayList<>();
        for (StockAlert a : stockAlertService.getByUserId(userId)) {
            Map<String, Object> m = new HashMap<>();
            m.put("productId", a.getProductId());
            m.put("productTitle", a.getProductTitle());
            m.put("productImage", a.getProductImage());
            m.put("email", a.getEmail());
            m.put("subscribedAt", a.getCreatedTime() == null ? null
                    : a.getCreatedTime().toInstant(ZoneOffset.UTC).toEpochMilli());
            m.put("notified", "notified".equals(a.getStatus()));
            result.add(m);
        }
        return ResponseVO.ok(result);
    }

    @PostMapping("")
    public ResponseVO<?> subscribe(@RequestBody StockAlertSubscribeDTO body) {
        // product_id 在库里是 NOT NULL:缺失时 insert 直接抛约束异常 → 500。
        // 它是这条业务的主键语义,缺失就是请求不合法 → 400。
        if (body.getProductId() == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "商品 id 不能为空");
        }
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        StockAlert alert = new StockAlert();
        alert.setUserId(userId);
        alert.setProductId(body.getProductId());
        alert.setProductTitle(body.getProductTitle());
        alert.setProductImage(body.getProductImage());
        alert.setEmail(body.getEmail());
        stockAlertService.subscribe(alert);
        return ResponseVO.ok();
    }

    @DeleteMapping("/{productId}")
    public ResponseVO<?> unsubscribe(@PathVariable Integer productId) {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        stockAlertService.unsubscribe(userId, productId);
        return ResponseVO.ok();
    }
}
