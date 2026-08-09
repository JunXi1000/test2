package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.Product;
import com.project.platform.entity.ProductOrder;
import com.project.platform.entity.Shop;
import com.project.platform.service.*;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Merchant API — matches frontend's /merchant/* contract.
 * All endpoints require SHOP role (enforced by the current user's type in service layer).
 */
@RestController
@RequestMapping("/merchant")
public class MerchantApiController {

    @Resource
    private ProductService productService;

    @Resource
    private ProductOrderService productOrderService;

    @Resource
    private ShopService shopService;

    @Resource
    private StatisticalReportFormsService statsService;

    // ── Dashboard ──────────────────────────────────────────────────────

    @GetMapping("/dashboard/stats")
    public ResponseVO<List<Map<String, Object>>> getDashboardStats() {
        List<Map<String, Object>> stats = new ArrayList<>();
        stats.add(buildStat("Total Sales", "$0", "+0%", "DollarSign"));
        stats.add(buildStat("Orders", "0", "+0%", "ShoppingCart"));
        stats.add(buildStat("Products", "0", "0%", "Package"));
        stats.add(buildStat("Conversion Rate", "0%", "0%", "TrendingUp"));
        return ResponseVO.ok(stats);
    }

    @GetMapping("/dashboard/low-stock")
    public ResponseVO<List<Map<String, Object>>> getLowStock() {
        Integer shopId = CurrentUserThreadLocal.getCurrentUser().getId();
        Map<String, Object> query = new HashMap<>();
        query.put("shopId", shopId);
        PageVO<Product> pageVO = productService.page(query, 1, 50);
        List<Map<String, Object>> lowStock = new ArrayList<>();
        for (Product p : pageVO.getList()) {
            if (p.getStock() != null && p.getStock() <= 5) {
                Map<String, Object> item = new HashMap<>();
                item.put("title", p.getName());
                item.put("sku", "SKU-" + p.getId());
                item.put("stock", p.getStock());
                lowStock.add(item);
            }
        }
        return ResponseVO.ok(lowStock);
    }

    // ── Products ───────────────────────────────────────────────────────

    @GetMapping("/products")
    public ResponseVO<List<Product>> getProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        Integer shopId = CurrentUserThreadLocal.getCurrentUser().getId();
        Map<String, Object> query = new HashMap<>();
        query.put("shopId", shopId);
        if (q != null && !q.isEmpty()) query.put("name", q);
        PageVO<Product> pageVO = productService.page(query, 1, 100);
        return ResponseVO.ok(pageVO.getList());
    }

    @PostMapping("/products")
    public ResponseVO<Product> createProduct(@RequestBody Product entity) {
        entity.setShopId(CurrentUserThreadLocal.getCurrentUser().getId());
        productService.insert(entity);
        return ResponseVO.ok(entity);
    }

    @PutMapping("/products/{id}")
    public ResponseVO<Product> updateProduct(@PathVariable Integer id, @RequestBody Product entity) {
        entity.setId(id);
        productService.updateById(entity);
        return ResponseVO.ok(productService.selectById(id));
    }

    @DeleteMapping("/products/{id}")
    public ResponseVO<?> deleteProduct(@PathVariable Integer id) {
        productService.removeByIds(List.of(id));
        return ResponseVO.ok();
    }

    // ── Orders ─────────────────────────────────────────────────────────

    @GetMapping("/orders")
    public ResponseVO<List<ProductOrder>> getOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q) {
        Integer shopId = CurrentUserThreadLocal.getCurrentUser().getId();
        Map<String, Object> query = new HashMap<>();
        query.put("shopId", shopId);
        if (status != null && !status.isEmpty() && !"all".equals(status)) {
            // Map frontend status to backend status
            String backendStatus = switch (status) {
                case "pending" -> "待支付";
                case "processing" -> "待发货";
                case "shipped" -> "待收货";
                case "delivered" -> "已完成";
                case "cancelled" -> "已取消";
                default -> status;
            };
            query.put("status", backendStatus);
        }
        PageVO<ProductOrder> pageVO = productOrderService.page(query, 1, 100);
        return ResponseVO.ok(pageVO.getList());
    }

    @GetMapping("/orders/{id}")
    public ResponseVO<ProductOrder> getOrderDetail(@PathVariable Integer id) {
        return ResponseVO.ok(productOrderService.selectById(id));
    }

    @PutMapping("/orders/{id}/status")
    public ResponseVO<?> updateOrderStatus(@PathVariable Integer id, @RequestBody JSONObject body) {
        String status = body.getString("status");
        ProductOrder order = productOrderService.selectById(id);
        if (order == null) return ResponseVO.fail(404, "Order not found");
        // Map frontend status to action
        switch (status) {
            case "processing" -> order.setStatus("待发货");
            case "shipped" -> {
                order.setStatus("待收货");
                order.setTrackingNumber("");
            }
            case "delivered" -> order.setStatus("已完成");
            case "cancelled" -> order.setStatus("已取消");
        }
        productOrderService.updateById(order);
        return ResponseVO.ok();
    }

    // ── Wallet ─────────────────────────────────────────────────────────

    @GetMapping("/wallet")
    public ResponseVO<Map<String, Object>> getWallet() {
        Map<String, Object> wallet = new HashMap<>();
        wallet.put("balance", 0);
        wallet.put("pending", 0);
        wallet.put("currency", "USD");
        return ResponseVO.ok(wallet);
    }

    @GetMapping("/wallet/transactions")
    public ResponseVO<List<Map<String, Object>>> getTransactions() {
        return ResponseVO.ok(Collections.emptyList());
    }

    @PostMapping("/wallet/withdraw")
    public ResponseVO<?> withdraw(@RequestBody JSONObject body) {
        return ResponseVO.ok();
    }

    // ── Settings ───────────────────────────────────────────────────────

    @GetMapping("/settings")
    public ResponseVO<Map<String, Object>> getSettings() {
        Integer shopId = CurrentUserThreadLocal.getCurrentUser().getId();
        Shop shop = shopService.selectById(shopId);
        Map<String, Object> settings = new HashMap<>();
        if (shop != null) {
            settings.put("storeName", shop.getName());
            settings.put("description", shop.getNickname());
            settings.put("logo", shop.getAvatarUrl());
            settings.put("email", shop.getEmail());
        }
        settings.put("location", "Unknown");
        settings.put("responseTime", "< 1 hour");
        settings.put("policies", Map.of("shipping", "", "returns", ""));
        settings.put("notifications", Map.of("email", true, "push", false, "sms", true));
        return ResponseVO.ok(settings);
    }

    @PutMapping("/settings")
    public ResponseVO<?> updateSettings(@RequestBody Map<String, Object> data) {
        return ResponseVO.ok();
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private Map<String, Object> buildStat(String label, String value, String change, String icon) {
        Map<String, Object> m = new HashMap<>();
        m.put("label", label);
        m.put("value", value);
        m.put("change", change);
        m.put("icon", icon);
        return m;
    }
}
