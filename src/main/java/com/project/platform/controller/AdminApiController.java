package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.*;
import com.project.platform.service.*;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin API — matches frontend's /admin/* contract.
 * Delegates to existing services for users, shops, products, orders, reviews.
 */
@RestController
@RequestMapping("/admin")
public class AdminApiController {

    @Resource private AdminService adminService;
    @Resource private UserService userService;
    @Resource private ShopService shopService;
    @Resource private ProductService productService;
    @Resource private ProductOrderService productOrderService;
    @Resource private ProductOrderEvaluateService evaluateService;
    @Resource private StatisticalReportFormsService statsService;

    // ── Dashboard ──────────────────────────────────────────────────────

    @GetMapping("/dashboard/stats")
    public ResponseVO<List<Map<String, Object>>> getDashboardStats() {
        List<Map<String, Object>> stats = new ArrayList<>();
        stats.add(buildStat("Total Revenue", "$0", "+0%", "DollarSign"));
        stats.add(buildStat("Active Users", "0", "+0%", "Users"));
        stats.add(buildStat("Sales", "0", "+0%", "ShoppingBag"));
        stats.add(buildStat("Active Now", "0", "+0", "Activity"));
        return ResponseVO.ok(stats);
    }

    @GetMapping("/dashboard/recent-users")
    public ResponseVO<List<Map<String, Object>>> getRecentUsers() {
        List<User> users = userService.list();
        List<Map<String, Object>> recent = users.stream()
                .limit(5)
                .map(u -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("name", u.getNickname());
                    m.put("email", u.getEmail());
                    m.put("joinedAt", u.getCreateTime() != null ? u.getCreateTime().toString() : "");
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(recent);
    }

    @GetMapping("/dashboard/revenue-chart")
    public ResponseVO<List<Map<String, Object>>> getRevenueChart() {
        return ResponseVO.ok(Collections.emptyList());
    }

    // ── Users ──────────────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseVO<List<Map<String, Object>>> getUsers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role) {
        List<User> users = userService.list();
        List<Map<String, Object>> result = users.stream()
                .filter(u -> {
                    if (role != null && !"all".equals(role)) return false; // admin lists all types via /user
                    if (q != null && !q.isEmpty()) {
                        String ql = q.toLowerCase();
                        return (u.getNickname() != null && u.getNickname().toLowerCase().contains(ql))
                                || (u.getEmail() != null && u.getEmail().toLowerCase().contains(ql));
                    }
                    return true;
                })
                .map(u -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", u.getId().toString());
                    m.put("name", u.getNickname());
                    m.put("email", u.getEmail());
                    m.put("role", "user");
                    m.put("status", "启用".equals(u.getStatus()) ? "active" : "suspended");
                    m.put("joinedAt", u.getCreateTime() != null ? u.getCreateTime().toString() : "");
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(result);
    }

    @PostMapping("/users/{id}/toggle-status")
    public ResponseVO<?> toggleUserStatus(@PathVariable Integer id) {
        User u = userService.selectById(id);
        if (u != null) {
            u.setStatus("启用".equals(u.getStatus()) ? "禁用" : "启用");
            userService.updateById(u);
        }
        return ResponseVO.ok();
    }

    @PutMapping("/users/{id}")
    public ResponseVO<?> updateUser(@PathVariable Integer id, @RequestBody Map<String, Object> data) {
        User u = userService.selectById(id);
        if (u != null) {
            if (data.containsKey("name")) u.setNickname((String) data.get("name"));
            if (data.containsKey("email")) u.setEmail((String) data.get("email"));
            userService.updateById(u);
        }
        return ResponseVO.ok();
    }

    @PostMapping("/users/{id}/reset-password")
    public ResponseVO<?> resetUserPassword(@PathVariable Integer id) {
        userService.resetPassword(id);
        return ResponseVO.ok();
    }

    @DeleteMapping("/users/{id}")
    public ResponseVO<?> deleteUser(@PathVariable Integer id) {
        userService.removeByIds(List.of(id));
        return ResponseVO.ok();
    }

    // ── Merchants ──────────────────────────────────────────────────────

    @GetMapping("/merchants")
    public ResponseVO<List<Map<String, Object>>> getMerchants(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        List<Shop> shops = shopService.list();
        List<Map<String, Object>> result = shops.stream()
                .filter(s -> {
                    if (status != null && !"all".equals(status)) {
                        String backendStatus = "active".equals(status) ? "启用" :
                                "pending".equals(status) ? "禁用" :
                                        "suspended".equals(status) ? "禁用" :
                                                "rejected".equals(status) ? "禁用" : status;
                        return backendStatus.equals(s.getStatus());
                    }
                    if (q != null && !q.isEmpty()) {
                        String ql = q.toLowerCase();
                        return (s.getName() != null && s.getName().toLowerCase().contains(ql))
                                || (s.getNickname() != null && s.getNickname().toLowerCase().contains(ql));
                    }
                    return true;
                })
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", s.getId().toString());
                    m.put("storeName", s.getName());
                    m.put("ownerName", s.getNickname());
                    m.put("email", s.getEmail());
                    m.put("status", "启用".equals(s.getStatus()) ? "active" : "pending");
                    m.put("joinedAt", s.getCreateTime() != null ? s.getCreateTime().toString() : "");
                    m.put("revenue", 0);
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(result);
    }

    @PostMapping("/merchants")
    public ResponseVO<?> createMerchant(@RequestBody Map<String, Object> data) {
        Shop shop = new Shop();
        shop.setName((String) data.get("storeName"));
        shop.setNickname((String) data.get("ownerName"));
        shop.setEmail((String) data.get("email"));
        shop.setUsername((String) data.get("email"));
        shop.setPassword("123456");
        shop.setStatus("启用");
        shop.setCreateTime(LocalDateTime.now());
        shopService.insert(shop);
        return ResponseVO.ok();
    }

    @PutMapping("/merchants/{id}")
    public ResponseVO<?> updateMerchant(@PathVariable Integer id, @RequestBody Map<String, Object> data) {
        Shop s = shopService.selectById(id);
        if (s != null) {
            if (data.containsKey("storeName")) s.setName((String) data.get("storeName"));
            if (data.containsKey("ownerName")) s.setNickname((String) data.get("ownerName"));
            if (data.containsKey("email")) s.setEmail((String) data.get("email"));
            shopService.updateById(s);
        }
        return ResponseVO.ok();
    }

    @PostMapping("/merchants/{id}/approve")
    public ResponseVO<?> approveMerchant(@PathVariable Integer id) {
        Shop s = shopService.selectById(id);
        if (s != null) { s.setStatus("启用"); shopService.updateById(s); }
        return ResponseVO.ok();
    }

    @PostMapping("/merchants/{id}/reject")
    public ResponseVO<?> rejectMerchant(@PathVariable Integer id) {
        Shop s = shopService.selectById(id);
        if (s != null) { s.setStatus("禁用"); shopService.updateById(s); }
        return ResponseVO.ok();
    }

    @DeleteMapping("/merchants/{id}")
    public ResponseVO<?> deleteMerchant(@PathVariable Integer id) {
        shopService.removeByIds(List.of(id));
        return ResponseVO.ok();
    }

    // ── Products ───────────────────────────────────────────────────────

    @GetMapping("/products")
    public ResponseVO<List<Map<String, Object>>> getProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        PageVO<Product> pageVO = productService.page(new HashMap<>(), 1, 100);
        List<Map<String, Object>> result = pageVO.getList().stream()
                .filter(p -> {
                    if (q != null && !q.isEmpty()) {
                        return p.getName().toLowerCase().contains(q.toLowerCase());
                    }
                    return true;
                })
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", p.getId());
                    m.put("title", p.getName());
                    m.put("merchant", p.getShopName());
                    m.put("price", p.getPrice());
                    m.put("status", "active");
                    m.put("image", p.getMainImg());
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(result);
    }

    @DeleteMapping("/products/{id}/ban")
    public ResponseVO<?> banProduct(@PathVariable Integer id) {
        Product p = productService.selectById(id);
        if (p != null) { p.setStock(0); productService.updateById(p); }
        return ResponseVO.ok();
    }

    // ── Orders ─────────────────────────────────────────────────────────

    @GetMapping("/orders")
    public ResponseVO<List<Map<String, Object>>> getOrders(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        Map<String, Object> query = new HashMap<>();
        if (status != null && !"all".equals(status)) {
            query.put("status", switch (status) {
                case "pending" -> "待支付"; case "processing" -> "待发货";
                case "shipped" -> "待收货"; case "delivered" -> "已完成";
                case "cancelled" -> "已取消"; default -> status;
            });
        }
        PageVO<ProductOrder> pageVO = productOrderService.page(query, 1, 100);
        List<Map<String, Object>> result = pageVO.getList().stream()
                .map(o -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", "ORD-" + o.getId());
                    m.put("user", o.getUsername());
                    m.put("merchant", o.getShopName());
                    m.put("total", o.getTotalMoney());
                    m.put("status", mapOrderStatus(o.getStatus()));
                    m.put("date", o.getCreateTime() != null ? o.getCreateTime().toString() : "");
                    m.put("items", o.getQuantity());
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(result);
    }

    @PostMapping("/orders/{id}/cancel")
    public ResponseVO<?> cancelOrder(@PathVariable Integer id) {
        productOrderService.cancel(id);
        return ResponseVO.ok();
    }

    // ── Reviews ────────────────────────────────────────────────────────

    @GetMapping("/reviews")
    public ResponseVO<List<Map<String, Object>>> getReviews(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        List<ProductOrderEvaluate> evals = evaluateService.list();
        List<Map<String, Object>> result = evals.stream()
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", "rev-" + e.getId());
                    m.put("productId", e.getProductId());
                    m.put("productTitle", e.getProductName());
                    m.put("userName", e.getUsername());
                    m.put("rating", e.getRate());
                    m.put("content", e.getContent());
                    m.put("createdAt", e.getCreateTime() != null ? e.getCreateTime().toString() : "");
                    m.put("status", "visible");
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(result);
    }

    @PutMapping("/reviews/{id}")
    public ResponseVO<?> updateReviewStatus(@PathVariable Integer id, @RequestBody JSONObject body) {
        return ResponseVO.ok();
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseVO<?> deleteReview(@PathVariable Integer id) {
        evaluateService.removeByIds(List.of(id));
        return ResponseVO.ok();
    }

    // ── Settings ───────────────────────────────────────────────────────

    @GetMapping("/settings")
    public ResponseVO<Map<String, Object>> getSettings() {
        Map<String, Object> settings = new HashMap<>();
        settings.put("siteName", "Nexus Market");
        settings.put("maintenanceMode", false);
        settings.put("allowRegistrations", true);
        settings.put("commissionRate", 5.0);
        return ResponseVO.ok(settings);
    }

    @PutMapping("/settings")
    public ResponseVO<?> updateSettings(@RequestBody Map<String, Object> data) {
        return ResponseVO.ok();
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private Map<String, Object> buildStat(String label, String value, String change, String icon) {
        Map<String, Object> m = new HashMap<>();
        m.put("label", label); m.put("value", value);
        m.put("change", change); m.put("icon", icon);
        return m;
    }

    private String mapOrderStatus(String status) {
        return switch (status != null ? status : "") {
            case "待支付" -> "pending"; case "待发货" -> "processing";
            case "待收货" -> "shipped"; case "已完成" -> "delivered";
            case "已取消" -> "cancelled"; default -> "pending";
        };
    }
}
