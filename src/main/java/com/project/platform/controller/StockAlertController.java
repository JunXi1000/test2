package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.StockAlert;
import com.project.platform.service.StockAlertService;
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
    public ResponseVO<?> subscribe(@RequestBody JSONObject body) {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        StockAlert alert = new StockAlert();
        alert.setUserId(userId);
        alert.setProductId(body.getInteger("productId"));
        alert.setProductTitle(body.getString("productTitle"));
        alert.setProductImage(body.getString("productImage"));
        alert.setEmail(body.getString("email"));
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
