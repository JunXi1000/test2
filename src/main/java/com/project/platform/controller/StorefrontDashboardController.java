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
     *
     * <p>2026-09-27 修复:「Pending」此前用减法推导
     * {@code total - inTransit - completed - cancelled}(再套一个 Math.max(0, …)),
     * 于是任何**不在那四个枚举里**的订单状态都会被算进 Pending ——
     * 比如将来新增的「退款中」会被无声地报成「待付款」。改为按状态**显式计数**。
     */
    @GetMapping("/stats")
    public ResponseVO<List<Map<String, Object>>> getStats() {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        Map<String, Object> query = new HashMap<>();
        query.put("userId", userId);
        PageVO<ProductOrder> pageVO = productOrderService.page(query, 1, 1000);
        List<ProductOrder> orders = pageVO.getList();

        long total = orders.size();
        long pending = countByStatus(orders, "待支付");
        long inTransit = countByStatus(orders, "待发货") + countByStatus(orders, "待收货");
        long completed = countByStatus(orders, "已完成");
        long cancelled = countByStatus(orders, "已取消");

        List<Map<String, Object>> stats = new ArrayList<>();
        stats.add(buildStat("Total Orders", String.valueOf(total)));
        stats.add(buildStat("In Transit", String.valueOf(inTransit)));
        stats.add(buildStat("Pending", String.valueOf(pending)));
        stats.add(buildStat("Completed", String.valueOf(completed)));
        return ResponseVO.ok(stats);
    }

    private long countByStatus(List<ProductOrder> orders, String status) {
        return orders.stream().filter(o -> status.equals(o.getStatus())).count();
    }

    private Map<String, Object> buildStat(String label, String value) {
        Map<String, Object> m = new HashMap<>();
        m.put("label", label);
        m.put("value", value);
        return m;
    }
}
