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
 * User dashboard API — matches frontend's expected /dashboard contract.
 */
@RestController
@RequestMapping("/dashboard")
public class StorefrontDashboardController {

    @Resource
    private ProductOrderService productOrderService;

    /**
     * GET /dashboard/stats
     */
    @GetMapping("/stats")
    public ResponseVO<List<Map<String, Object>>> getStats() {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        Map<String, Object> query = new HashMap<>();
        query.put("userId", userId);
        PageVO<ProductOrder> pageVO = productOrderService.page(query, 1, 1000);
        List<ProductOrder> orders = pageVO.getList();

        long total = orders.size();
        long inTransit = orders.stream().filter(o -> "待发货".equals(o.getStatus()) || "待收货".equals(o.getStatus())).count();
        long completed = orders.stream().filter(o -> "已完成".equals(o.getStatus())).count();
        long cancelled = orders.stream().filter(o -> "已取消".equals(o.getStatus())).count();

        List<Map<String, Object>> stats = new ArrayList<>();
        stats.add(buildStat("Total Orders", String.valueOf(total)));
        stats.add(buildStat("In Transit", String.valueOf(inTransit)));
        stats.add(buildStat("Pending", String.valueOf(Math.max(0, total - inTransit - completed - cancelled))));
        stats.add(buildStat("Completed", String.valueOf(completed)));
        return ResponseVO.ok(stats);
    }

    private Map<String, Object> buildStat(String label, String value) {
        Map<String, Object> m = new HashMap<>();
        m.put("label", label);
        m.put("value", value);
        return m;
    }
}
