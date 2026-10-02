package com.project.platform.controller;

import com.project.platform.dto.AdminMerchantUpsertDTO;
import com.project.platform.dto.AdminUserUpdateDTO;
import com.project.platform.entity.*;
import com.project.platform.exception.CustomException;
import com.project.platform.service.*;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import com.project.platform.vo.RevenuePointVO;
import com.project.platform.vo.StatVO;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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
    @Resource private AnalyticsService analyticsService;

    // ── Dashboard ──────────────────────────────────────────────────────

    /**
     * GET /admin/dashboard/stats
     *
     * <p>2026-09-27 起为真实聚合(此前 4 个指标全部硬编码 "$0"/"0"/"+0%")。
     * 口径见 {@link AnalyticsService#adminDashboardStats()}。
     */
    @GetMapping("/dashboard/stats")
    public ResponseVO<List<StatVO>> getDashboardStats() {
        return ResponseVO.ok(analyticsService.adminDashboardStats());
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

    /**
     * GET /admin/dashboard/revenue-chart?days=7
     *
     * <p>2026-09-27 起为真实按自然日聚合(此前恒返回空列表)。没有订单的日期会补 0,
     * 保证 ECharts 的 category 轴连续。{@code days} 由服务层收敛到 1~31。
     */
    @GetMapping("/dashboard/revenue-chart")
    public ResponseVO<List<RevenuePointVO>> getRevenueChart(
            @RequestParam(required = false, defaultValue = "7") Integer days) {
        return ResponseVO.ok(analyticsService.adminRevenueChart(days == null ? 7 : days));
    }

    // ── Users ──────────────────────────────────────────────────────────

    /**
     * GET /admin/users?q=&role=
     *
     * <p>2026-09-27 修复:{@code role} 此前是 {@code if (role != null && !"all".equals(role)) return false;}
     * —— 任何非 all 的值(包括前端下拉里的 "user")都直接返回**空列表**,角色筛选恒等于「无结果」。
     *
     * <p>现在的口径:{@code role} 缺省 / "all" / "user" → 本端点的全部用户
     * ({@code user} 表);"admin" / "merchant" → 空集。
     *
     * <p><b>为什么不返回 admin/shop 表的行</b>:前端 {@code AdminUser} 的行操作
     * (toggle-status / reset-password / delete)都只带一个 id 打到本端点,
     * 而 id 在 user / admin / shop 三张表里各自从 1 开始。把另两张表的行混进来会让
     * 「删除用户 1」误删一个毫不相干的管理员 —— 比返回空集危险得多。
     * 真正的跨角色管理应由 {@code /admin/merchants} 承担(它已是真实实现)。
     * 「Users 页角色下拉含 Merchant/Admin」属前端用法问题,已上报总控。
     */
    @GetMapping("/users")
    public ResponseVO<List<Map<String, Object>>> getUsers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role) {
        List<User> users = userService.list();
        List<Map<String, Object>> result = users.stream()
                .filter(u -> matchesUserRole(role))
                .filter(u -> {
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

    /**
     * role 过滤:本端点只服务 {@code user} 表,所以只有 user / all / 缺省能命中。
     * 未知值(如前端拼错的 "USER ")一律不命中 —— 静默忽略未知值会让人以为筛选生效了。
     */
    private boolean matchesUserRole(String role) {
        if (role == null || role.isEmpty() || "all".equalsIgnoreCase(role) || "user".equalsIgnoreCase(role)) {
            return true;
        }
        return false;
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
    public ResponseVO<?> updateUser(@PathVariable Integer id, @RequestBody AdminUserUpdateDTO data) {
        User u = userService.selectById(id);
        if (u != null) {
            // 既有实现用 containsKey 判断;换成 DTO 后 null 即视为不更新(显式 null 不再置空)
            if (data.getName() != null) u.setNickname(data.getName());
            if (data.getEmail() != null) u.setEmail(data.getEmail());
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
        // 累计销售额此前硬编码 0;现在一次聚合取回全店营收,再按 id 命中
        Map<Integer, BigDecimal> revenues = analyticsService.revenueByShop();
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
                    // 没有已支付订单的店铺不在聚合结果里,按 0 兜底(不是 null)
                    m.put("revenue", revenues.getOrDefault(s.getId(), BigDecimal.ZERO));
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(result);
    }

    @PostMapping("/merchants")
    public ResponseVO<?> createMerchant(@Valid @RequestBody AdminMerchantUpsertDTO data) {
        Shop shop = new Shop();
        shop.setName(data.getStoreName());
        shop.setNickname(data.getOwnerName());
        shop.setEmail(data.getEmail());
        // 登录标识沿用 email(既有约定:商家用邮箱当用户名登录)
        shop.setUsername(data.getEmail());
        // 不设密码:ShopServiceImpl.insert 在密码为 null 时会用**配置项** resetPassword 填充并加密。
        // 此前这里硬编码 "123456" —— 硬编码口令会随仓库一起公开,且绕过了那条可配置的默认值。
        // 商家首次登录后应自行改密;管理员也可用 /common/resetPassword(type=SHOP) 重置。
        shop.setStatus("启用");
        shop.setCreateTime(LocalDateTime.now());
        shopService.insert(shop);
        return ResponseVO.ok();
    }

    @PutMapping("/merchants/{id}")
    public ResponseVO<?> updateMerchant(@PathVariable Integer id, @RequestBody AdminMerchantUpsertDTO data) {
        Shop s = shopService.selectById(id);
        if (s != null) {
            // 既有实现用 containsKey 判断;换成 DTO 后 null 即视为不更新
            if (data.getStoreName() != null) s.setName(data.getStoreName());
            if (data.getOwnerName() != null) s.setNickname(data.getOwnerName());
            if (data.getEmail() != null) s.setEmail(data.getEmail());
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

    /**
     * GET /admin/products?q=&status=
     *
     * <p>2026-09-27 修复:{@code status} 此前接收后从不使用(管理端商品状态筛选无效)。
     * {@code product} 表没有 status 列(本轮无 schema 权限,见 04b-SCHEMA-REQUIREMENTS.md),
     * 故当前域只有一个取值:status=active 返回全部,draft/archived 如实返回空集。
     */
    @GetMapping("/products")
    public ResponseVO<List<Map<String, Object>>> getProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        if (!matchesProductStatus(status)) {
            return ResponseVO.ok(List.of());
        }
        PageVO<Product> pageVO = productService.page(new HashMap<>(), 1, 100);
        List<Map<String, Object>> result = pageVO.getList().stream()
                .filter(p -> {
                    if (q != null && !q.isEmpty()) {
                        return p.getName() != null && p.getName().toLowerCase().contains(q.toLowerCase());
                    }
                    return true;
                })
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", p.getId());
                    m.put("title", p.getName());
                    m.put("merchant", p.getShopName());
                    m.put("price", p.getPrice());
                    // 无 status 列时,响应里的 status 只能如实反映「无草稿态」这一事实
                    m.put("status", "active");
                    m.put("image", p.getMainImg());
                    // 2026-09-27:补 description(product.intro)。
                    // 管理端商品列表此前不返回它,前端 web/src/pages/admin/Products.vue:134
                    // 只能显示占位文案 —— 占位是遮掩不是解决,管理员要改详情就得看到原文。
                    m.put("description", p.getIntro());
                    return m;
                }).collect(Collectors.toList());
        return ResponseVO.ok(result);
    }

    /** 缺省 / all / active 命中;draft / archived 因库中无该状态而返回空集 */
    private boolean matchesProductStatus(String status) {
        return status == null || status.isEmpty() || "all".equalsIgnoreCase(status) || "active".equalsIgnoreCase(status);
    }

    @DeleteMapping("/products/{id}/ban")
    public ResponseVO<?> banProduct(@PathVariable Integer id) {
        Product p = productService.selectById(id);
        if (p != null) { p.setStock(0); productService.updateById(p); }
        return ResponseVO.ok();
    }

    // ── Orders ─────────────────────────────────────────────────────────

    /**
     * GET /admin/orders?q=&status=
     *
     * <p>2026-09-27 修复:{@code q} 此前接收后从不使用(管理端订单搜索框完全失效)。
     * 现在下推到 SQL 的 {@code keyword} 条件(订单号 / 商品名 / 收货人 / 收货电话)。
     */
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
        if (q != null && !q.isEmpty()) query.put("keyword", q);
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

    /**
     * GET /admin/reviews?q=&status=
     *
     * <p>2026-09-27 修复:{@code q} 与 {@code status} 此前**都接收后从不使用** ——
     * 管理端评论页的搜索框与「Visible / Hidden」筛选都是摆设。
     *
     * <p>{@code q} 现在真实生效(按 id / 商品 / 用户名 / 内容模糊匹配)。
     * {@code status} 依赖 {@code product_order_evaluate.review_status} 列 —— 该列由
     * 仓库里的 {@code sql/migrations/V8__review_moderation.sql} 引入,**本轮未应用该迁移**
     * (由运维单独裁决)。故当前域只有 visible 一档:
     * status=hidden 如实返回空集,而不是把全部评论当成「已隐藏」。
     */
    @GetMapping("/reviews")
    public ResponseVO<List<Map<String, Object>>> getReviews(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        if (!matchesReviewStatus(status)) {
            return ResponseVO.ok(List.of());
        }
        List<ProductOrderEvaluate> evals = evaluateService.list();
        List<Map<String, Object>> result = evals.stream()
                .filter(e -> matchesReviewKeyword(e, q))
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

    /**
     * 缺省 / all / visible 命中;hidden 返回空集。
     *
     * <p>审查状态只有 visible 一档,原因是<b>本轮未应用 V8 迁移</b>
     * (该迁移才引入 {@code product_order_evaluate.review_status} 列),
     * 不是「库里没有这个概念」。迁移脚本已在仓库里,由运维单独裁决是否执行。
     */
    private boolean matchesReviewStatus(String status) {
        return status == null || status.isEmpty() || "all".equalsIgnoreCase(status) || "visible".equalsIgnoreCase(status);
    }

    /** 关键词匹配 id / 商品名 / 用户名 / 评论内容;字段为 null 时不参与匹配而不是 NPE */
    private boolean matchesReviewKeyword(ProductOrderEvaluate e, String q) {
        if (q == null || q.isEmpty()) {
            return true;
        }
        String ql = q.toLowerCase();
        return contains(e.getId() == null ? null : String.valueOf(e.getId()), ql)
                || contains(e.getProductName(), ql)
                || contains(e.getUsername(), ql)
                || contains(e.getContent(), ql);
    }

    private boolean contains(String value, String lowercaseNeedle) {
        return value != null && value.toLowerCase().contains(lowercaseNeedle);
    }

    @PutMapping("/reviews/{id}")
    public ResponseVO<?> updateReviewStatus(@PathVariable Integer id) {
        // 该端点原本接收 body 但**从不读取**(前端发 {status},被静默丢弃,却返回 200)。
        // 入参已去掉以如实表达「输入被忽略」;是补实现还是删端点属业务决策,留给 Phase 4。
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

    /**
     * PUT /admin/settings — <b>未实现,如实返回 501</b>。
     *
     * <p>此前该端点接收 body 却**从不读取**(前端发完整 settings 被静默丢弃)并返回
     * 200「操作成功」—— 管理端因此相信设置已保存,刷新后全部丢失。假成功比报错更糟:
     * 它让「没做」这件事在客户端不可观测。真正的实现需要 {@code admin_setting} 表
     * (见 docs/TASK-000/04b-SCHEMA-REQUIREMENTS.md),本轮不落地。
     *
     * <p>改 501 而非 404:路由与处理器都在,是「服务端尚未实现该方法」,
     * 语义与 RFC 9110 的 501 Not Implemented 一致。
     */
    @PutMapping("/settings")
    public ResponseVO<?> updateSettings() {
        throw new CustomException(HttpStatus.NOT_IMPLEMENTED,
                "平台设置保存尚未实现:无 admin_setting 表可落库,本轮不写入(此前返回 200 是假成功)");
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private String mapOrderStatus(String status) {
        return switch (status != null ? status : "") {
            case "待支付" -> "pending"; case "待发货" -> "processing";
            case "待收货" -> "shipped"; case "已完成" -> "delivered";
            case "已取消" -> "cancelled"; default -> "pending";
        };
    }
}
