package com.project.platform.controller;

import com.project.platform.dto.MerchantOrderStatusDTO;
import com.project.platform.entity.Product;
import com.project.platform.entity.ProductOrder;
import com.project.platform.entity.Shop;
import com.project.platform.exception.CustomException;
import com.project.platform.service.*;
import com.project.platform.utils.AccessGuard;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import com.project.platform.vo.StatVO;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Merchant API — matches frontend's /merchant/* contract.
 * All endpoints require SHOP role (enforced by the current user's type in service layer).
 */
@RestController
@RequestMapping("/merchant")
public class MerchantApiController {

    /**
     * 商家可提交的目标状态(前端枚举)。cancelled 走独立分支(回补库存 + 退款),
     * 不受状态机表约束 —— 取消在任何非终态都应被允许。
     */
    private static final Set<String> ALLOWED_TARGET_STATUSES =
            Set.of("processing", "shipped", "delivered", "cancelled");

    /**
     * 订单状态机:当前状态(DB 中文枚举) → 允许的目标状态(前端英文枚举)。
     *
     * <p>链路是线性的:待支付 → 待发货 → 待收货 → 已完成。
     * 终态(已完成 / 已取消)不再允许向前跳 —— 越级跳转会让库存、支付单、
     * 退款三条链路彼此脱节(例如未发货直接「已完成」,永远不会有物流单号)。
     */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            "待支付", Set.of("processing", "cancelled"),
            "待发货", Set.of("shipped", "cancelled"),
            "待收货", Set.of("delivered", "cancelled"),
            "已完成", Set.of(),
            "已取消", Set.of());

    @Resource
    private ProductService productService;

    @Resource
    private ProductOrderService productOrderService;

    @Resource
    private ShopService shopService;

    @Resource
    private AnalyticsService analyticsService;

    // ── Dashboard ──────────────────────────────────────────────────────

    /**
     * GET /merchant/dashboard/stats
     *
     * <p>2026-09-27 起为真实聚合(此前 4 个指标全部硬编码 "$0"/"0")。
     *
     * <p><b>shopId 取自 token</b>({@code CurrentUserThreadLocal}),不读任何请求参数 ——
     * 商家因此无法通过伪造参数看到别家店铺的经营数据。
     */
    @GetMapping("/dashboard/stats")
    public ResponseVO<List<StatVO>> getDashboardStats() {
        return ResponseVO.ok(analyticsService.merchantDashboardStats(currentShopId()));
    }

    @GetMapping("/dashboard/low-stock")
    public ResponseVO<List<Map<String, Object>>> getLowStock() {
        Integer shopId = currentShopId();
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

    /**
     * GET /merchant/products?q=&status=
     *
     * <p>2026-09-27 修复:{@code status} 此前**接收后从不使用**(商家端商品状态筛选形同虚设)。
     * 但 {@code product} 表没有 status 列(属 TASK-000-D2 的 schema 变更,本轮无权限),
     * 故当前域里所有商品都处于「上架」语义:status=active 返回全部,
     * draft/archived 如实返回空集 —— 而不是把全部商品返回回去假装筛选生效。
     */
    @GetMapping("/products")
    public ResponseVO<List<Product>> getProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        Integer shopId = currentShopId();
        Map<String, Object> query = new HashMap<>();
        query.put("shopId", shopId);
        if (q != null && !q.isEmpty()) query.put("name", q);
        if (status != null && !status.isEmpty() && !"all".equals(status) && !"active".equals(status)) {
            return ResponseVO.ok(List.of());
        }
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
        Product existing = productService.selectById(id);
        AccessGuard.checkOwner(existing != null ? existing.getShopId() : null, CurrentUserThreadLocal.getCurrentUser(), "商品");
        productService.updateById(entity);
        return ResponseVO.ok(productService.selectById(id));
    }

    @DeleteMapping("/products/{id}")
    public ResponseVO<?> deleteProduct(@PathVariable Integer id) {
        Product existing = productService.selectById(id);
        AccessGuard.checkOwner(existing != null ? existing.getShopId() : null, CurrentUserThreadLocal.getCurrentUser(), "商品");
        productService.removeByIds(List.of(id));
        return ResponseVO.ok();
    }

    // ── Orders ─────────────────────────────────────────────────────────

    /**
     * GET /merchant/orders?status=&q=
     *
     * <p>2026-09-27 修复:{@code q} 此前**接收后从不使用**(商家端订单搜索框完全失效)。
     * 现在下推到 SQL 的 {@code keyword} 条件,按「订单号 / 商品名 / 收货人 / 收货电话」匹配。
     */
    @GetMapping("/orders")
    public ResponseVO<List<ProductOrder>> getOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q) {
        Integer shopId = currentShopId();
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
        if (q != null && !q.isEmpty()) query.put("keyword", q);
        PageVO<ProductOrder> pageVO = productOrderService.page(query, 1, 100);
        return ResponseVO.ok(pageVO.getList());
    }

    @GetMapping("/orders/{id}")
    public ResponseVO<ProductOrder> getOrderDetail(@PathVariable Integer id) {
        return ResponseVO.ok(productOrderService.selectById(id));
    }

    /**
     * PUT /merchant/orders/{id}/status
     *
     * <p>2026-09-27 新增<b>状态机前置校验</b>:此前只判「status 是不是已知枚举」,
     * 不判「能不能从当前状态跳过去」,于是「待支付」可以一步跳到「已完成」——
     * 一个从未发货的订单凭空变成已送达,库存与退款链路全都不对。
     * 非法跳转现在返回 <b>400</b>,并带上当前状态与允许的目标状态。
     *
     * <p><b>归属校验不在这里</b>:它由 Service 层承担
     * ({@code ProductOrderServiceImpl.selectById} / {@code updateById} / {@code cancelByOrderNo}),
     * 本控制器不叠加重复校验。
     */
    @PutMapping("/orders/{id}/status")
    public ResponseVO<?> updateOrderStatus(@PathVariable Integer id, @RequestBody MerchantOrderStatusDTO body) {
        String status = body.getStatus();
        // 此前 switch(status) 没有 default,status 缺失 → switch(null) 抛 NPE → 500。
        // 请求不合法应当是 400。
        if (status == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "status 不能为空");
        }
        // 先判枚举合法性,再谈状态机 —— 未知枚举值不该拿到「当前状态」的细节
        if (!ALLOWED_TARGET_STATUSES.contains(status)) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "不支持的 status: " + status);
        }
        ProductOrder order = productOrderService.selectById(id);
        if (order == null) {
            // 说明:本分支**当前不可达** —— productOrderService.selectById 内部已对 null 抛
            // CustomException(NOT_FOUND, "订单不存在"),永远不会返回 null 到这里。
            // 保留它并改成抛异常(而非 `return ResponseVO.fail(404, ...)`):后者未包 ResponseEntity、
            // 类/方法上也无 @ResponseStatus,若真被执行会返回 **HTTP 200 + body 里 404**,是个陷阱写法。
            throw new CustomException(HttpStatus.NOT_FOUND, "Order not found");
        }
        // 状态机前置校验(仅对非取消分支;取消的合法性由 Service 的幂等推进保证)
        if (!"cancelled".equals(status)) {
            Set<String> allowedTargets = ALLOWED_TRANSITIONS.getOrDefault(
                    order.getStatus() == null ? "" : order.getStatus(), Set.of());
            if (!allowedTargets.contains(status)) {
                throw new CustomException(HttpStatus.BAD_REQUEST,
                        "订单当前状态为「" + order.getStatus() + "」,不能变更为「" + status + "」;允许的目标状态:"
                                + (allowedTargets.isEmpty() ? "无(终态)" : String.join("/", allowedTargets)));
            }
        }
        // Map frontend status to action
        switch (status) {
            case "processing" -> order.setStatus("待发货");
            case "shipped" -> {
                order.setStatus("待收货");
                // ⚠️ 这里把快递单号置空串,而不是记录商家填写的单号 —— DTO 里没有该字段,
                // 属 TASK-000-D2 的契约/模型变更(已写入 04b-SCHEMA-REQUIREMENTS.md)。
                // 在那之前,至少不要再把已有的单号擦掉。
                if (order.getTrackingNumber() == null) {
                    order.setTrackingNumber("");
                }
            }
            case "delivered" -> order.setStatus("已完成");
            default -> {
                // 上面已按 ALLOWED_TARGET_STATUSES 拦下未知值;走到这里说明集合与 switch 失同步。
                throw new CustomException(HttpStatus.BAD_REQUEST, "不支持的 status: " + status);
            }
            case "cancelled" -> {
                // 取消必须走与前台同一套逻辑:回补库存 + 按支付渠道退款 + 推进支付单。
                // 此前这里只把 status 改成「已取消」—— 库存永不回补、钱不退、支付单不动,
                // 而订单按 order_no 分组展示,结果是留下一组「半取消」的订单。
                if (order.getOrderNo() != null && !order.getOrderNo().isEmpty()) {
                    productOrderService.cancelByOrderNo(order.getOrderNo());
                } else {
                    // 旧行(order_no 为空)没有分组,走单行取消(同样带归属校验与渠道一致的退款)
                    productOrderService.cancel(id);
                }
                return ResponseVO.ok();
            }
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

    /**
     * POST /merchant/wallet/withdraw — <b>未实现,如实返回 501</b>。
     *
     * <p>此前接收 {@code {amount, destinationId, ...}} 却从不读取,直接返回 200 ——
     * 商家端因此显示「提现已受理」,而钱、流水、余额三处都没有任何变化。
     * 真正的实现需要钱包/提现表与结算服务(见
     * docs/TASK-000/04b-SCHEMA-REQUIREMENTS.md 与 {@code sql/migrations/V6__merchant_wallet.sql},
     * 后者**本轮未应用**),本轮不落地。
     */
    @PostMapping("/wallet/withdraw")
    public ResponseVO<?> withdraw() {
        throw new CustomException(HttpStatus.NOT_IMPLEMENTED,
                "提现尚未实现:无钱包流水与提现表可落库,本轮不写入(此前返回 200 是假成功)");
    }

    // ── Settings ───────────────────────────────────────────────────────

    @GetMapping("/settings")
    public ResponseVO<Map<String, Object>> getSettings() {
        Integer shopId = currentShopId();
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

    /**
     * PUT /merchant/settings — <b>未实现,如实返回 501</b>。
     *
     * <p>与 {@link #withdraw()} 同因:此前静默丢弃完整 settings 请求体并返回 200。
     * 落库需要 {@code merchant_setting} 表,本轮不落地。
     */
    @PutMapping("/settings")
    public ResponseVO<?> updateSettings() {
        throw new CustomException(HttpStatus.NOT_IMPLEMENTED,
                "店铺设置保存尚未实现:无 merchant_setting 表可落库,本轮不写入(此前返回 200 是假成功)");
    }

    // ── Helpers ────────────────────────────────────────────────────────

    /**
     * 当前登录店铺的 id —— **只来自 token**,不读请求参数。
     * 集中在一处,避免某个端点日后改成读参数就开出了横向越权。
     */
    private Integer currentShopId() {
        return CurrentUserThreadLocal.getCurrentUser().getId();
    }
}
