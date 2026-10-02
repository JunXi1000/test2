package com.project.platform.controller;

import com.project.platform.entity.ProductOrder;
import com.project.platform.mapper.ProductOrderMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 商家端订单的**对象级归属**回归网(横向越权防护)。
 *
 * <p><b>为什么单独一个类</b>:现有 {@code AuthorizationBaselineTest} 验的是「路径 → 角色」
 * 这一层(哪个角色能碰哪个前缀),而本类验的是更下一层的「**这个具体订单是不是你这家店的**」。
 * 两者是不同的失效模式:角色对了不代表对象对了 —— 商家 A 完全可以用自己合法的 SHOP token
 * 去读/改商家 B 的订单,而路径层的规则表对此完全无感。
 *
 * <p><b>覆盖的三个入口</b>(归属校验下沉在 Service 层,本类把该结论钉成断言):
 * <ul>
 *   <li>{@code GET  /merchant/orders/{id}} → {@code ProductOrderServiceImpl.selectById} → {@code checkOrderOwner}</li>
 *   <li>{@code PUT  /merchant/orders/{id}/status} → {@code selectById} + {@code updateById} 两处各自校验</li>
 *   <li>{@code POST /merchant/orders/{id}/status}(cancelled)→ {@code cancelByOrderNo} / {@code cancel}</li>
 * </ul>
 *
 * <p><b>对应验收项 AC-02.3(护栏,非待修缺陷)</b>:shop1 访问 shop2 的订单应 403 ——
 * 这条**当前就成立**,所以本类是**回归防护**而非缺陷报告。
 * 若哪天这里真的跑出非 403,说明归属校验被改坏了,那是新引入的 Blocker,须立即上报。
 *
 * <p><b>测试数据</b>:schema-h2.sql 的种子订单(id=1)属于 shop 1,无法用于跨店铺断言,
 * 故本类现造一行属于 **shop 2** 的订单(商品 3 归 shop 2),再用 shop1 的 token 去碰它。
 */
class MerchantOrderOwnershipTest extends BaseControllerTest {

    @Autowired
    private ProductOrderMapper productOrderMapper;

    @Autowired
    private JdbcTemplate jdbc;

    /** 造一笔属于 shop 2 的订单(作为 shop 1 的越权目标),状态默认「待支付」 */
    private Integer seedOrderOfShop2() {
        return seedOrderOfShop2("待支付", null);
    }

    /**
     * 造一笔属于 shop 2 的订单,可指定初始状态与快递单号。
     *
     * @param status         初始状态(须落在状态机允许的取值内:待支付/待发货/待收货/已完成/已取消)
     * @param trackingNumber 已有快递单号;传 null 表示「此前没有单号」
     */
    private Integer seedOrderOfShop2(String status, String trackingNumber) {
        ProductOrder order = new ProductOrder();
        order.setOrderNo("QA-SHOP2-1");
        order.setProductId(3);            // product 3 → shop_id 2
        order.setProductName("Test Product 3");
        order.setShopId(2);
        order.setShopName("Store Two");
        order.setTotalMoney(new BigDecimal("199.00"));
        order.setQuantity(1);
        order.setUserId(1);
        order.setUsername("Test User");
        order.setStatus(status);
        order.setTrackingNumber(trackingNumber);
        productOrderMapper.insert(order);
        return order.getId();
    }

    private int stockOfProduct3() {
        return jdbc.queryForObject("SELECT stock FROM product WHERE id = 3", Integer.class);
    }

    // ── 越权：shop1 碰 shop2 的订单，一律 403 ─────────────────────────────

    @Test
    @DisplayName("AC-02.3 越权:shop1 读 shop2 的订单详情 → 403(不是 200,也不是 404)")
    void shopCannotReadAnotherShopsOrder() throws Exception {
        Integer orderId = seedOrderOfShop2();
        get("/merchant/orders/" + orderId, shopToken())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("AC-02.3 越权:shop1 改 shop2 的订单状态 → 403,且状态未被改写")
    void shopCannotChangeAnotherShopsOrderStatus() throws Exception {
        Integer orderId = seedOrderOfShop2();
        put("/merchant/orders/" + orderId + "/status", shopToken(), Map.of("status", "shipped"))
                .andExpect(status().isForbidden());
        assertEquals("待支付", productOrderMapper.selectById(orderId).getStatus(),
                "越权请求不得改写他人订单状态");
    }

    @Test
    @DisplayName("AC-02.3 越权:shop1 取消 shop2 的订单 → 403,状态与库存均不得变动")
    void shopCannotCancelAnotherShopsOrder() throws Exception {
        Integer orderId = seedOrderOfShop2();
        int stockBefore = stockOfProduct3();
        // 注意是 PUT:cancelled 只是 PUT /merchant/orders/{id}/status 的一个 status 取值,
        // 该端点没有 POST 映射(用 POST 会得到 405,那是方法错配,不是授权结论)。
        put("/merchant/orders/" + orderId + "/status", shopToken(), Map.of("status", "cancelled"))
                .andExpect(status().isForbidden());
        assertEquals("待支付", productOrderMapper.selectById(orderId).getStatus(),
                "越权取消不得改写他人订单状态");
        assertEquals(stockBefore, stockOfProduct3(), "越权取消不得回补他人商品库存");
    }

    // ── 正向：owner 与 ADMIN 应当放行(防止守卫写过头) ────────────────────

    @Test
    @DisplayName("正向:shop2 读自己的订单 → 200")
    void shopCanReadOwnOrder() throws Exception {
        Integer orderId = seedOrderOfShop2();
        get("/merchant/orders/" + orderId, shop2Token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    /**
     * 正向:shop2 沿**完整合法链路**推进自己的订单 → 200 且每一步状态都真的改写。
     *
     * <p>⚠️ 必须两步走,不能一步到位:2026-09-27 起
     * {@code MerchantApiController.ALLOWED_TRANSITIONS} 加了状态机前置校验
     * (待支付 → {processing, cancelled}),所以「待支付 → shipped」现在**正确地**返回 400。
     * 本用例的本意是验**归属校验**(owner 能改),不是验状态机,故沿
     * {@code 待支付 → processing → shipped} 这条合法路径走通 —— 它也正是商家端的真实动线。
     */
    @Test
    @DisplayName("正向:shop2 改自己订单的状态(待支付→processing→shipped 合法链路)→ 200 且状态真的改写")
    void shopCanChangeOwnOrderStatus() throws Exception {
        Integer orderId = seedOrderOfShop2("待支付", null);
        put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "processing"))
                .andExpect(status().isOk());
        assertEquals("待发货", productOrderMapper.selectById(orderId).getStatus(),
                "第一步 待支付→待发货 应落库");

        put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "shipped"))
                .andExpect(status().isOk());
        assertEquals("待收货", productOrderMapper.selectById(orderId).getStatus(),
                "第二步 待发货→待收货 应落库");
    }

    // ── 状态机(AC-02.1 / 终态出边)—— 2026-09-27 新增实现,此前无用例守护 ──

    @Test
    @DisplayName("AC-02.1 越级跳转:待支付 直接 shipped → 400,且 DB 状态未被改写")
    void skippingProcessingIsRejected() throws Exception {
        Integer orderId = seedOrderOfShop2("待支付", null);
        put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "shipped"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
        assertEquals("待支付", productOrderMapper.selectById(orderId).getStatus(),
                "非法跃迁被拒后,DB 状态必须原封不动");
    }

    @Test
    @DisplayName("AC-02.1 越级跳转:待支付 直接 delivered → 400(不得一步跳到终态)")
    void skippingStraightToDeliveredIsRejected() throws Exception {
        Integer orderId = seedOrderOfShop2("待支付", null);
        put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "delivered"))
                .andExpect(status().isBadRequest());
        assertEquals("待支付", productOrderMapper.selectById(orderId).getStatus());
    }

    @Test
    @DisplayName("终态无出边:已完成的订单不能再被改状态 → 400")
    void terminalStateHasNoOutgoingEdge() throws Exception {
        Integer orderId = seedOrderOfShop2("已完成", "SF123");
        for (String target : new String[]{"processing", "shipped", "delivered"}) {
            put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", target))
                    .andExpect(status().isBadRequest());
        }
        ProductOrder after = productOrderMapper.selectById(orderId);
        assertEquals("已完成", after.getStatus(),
                "已完成是终态,不应允许再变更为 processing/shipped/delivered");
        assertEquals("SF123", after.getTrackingNumber(), "终态订单的单号不该被动过");
    }

    @Test
    @DisplayName("终态无出边:已取消的订单不能再被改状态 → 400")
    void cancelledStateHasNoOutgoingEdge() throws Exception {
        Integer orderId = seedOrderOfShop2("已取消", null);
        put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "processing"))
                .andExpect(status().isBadRequest());
        assertEquals("已取消", productOrderMapper.selectById(orderId).getStatus());
    }

    @Test
    @DisplayName("发货不得擦除已有快递单号(shipped 分支只补空,不覆盖)")
    void shippingPreservesExistingTrackingNumber() throws Exception {
        // backend 报告:case "shipped" 原先无条件 setTrackingNumber(""),会把商家先前写入的单号抹掉;
        // 现改为「原值非 null 时保留」。本用例钉住该行为。
        Integer orderId = seedOrderOfShop2("待发货", "SF-EXISTING-001");
        put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "shipped"))
                .andExpect(status().isOk());
        assertEquals("SF-EXISTING-001", productOrderMapper.selectById(orderId).getTrackingNumber(),
                "发货不应擦除已存在的快递单号");
    }

    @Test
    @DisplayName("发货时原本没有单号 → 落成空串而非 null(AC-02.2 的当前契约)")
    void shippingWithoutExistingTrackingNumberFallsBackToEmptyString() throws Exception {
        Integer orderId = seedOrderOfShop2("待发货", null);
        put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "shipped"))
                .andExpect(status().isOk());
        String tracking = productOrderMapper.selectById(orderId).getTrackingNumber();
        assertNotNull(tracking, "单号不应写成 null(否则前端会拿到 'null' 字面量)");
        // 注:AC-02.2 要求「发货后 tracking_number 非空」,而 DTO 里目前**没有该字段**,
        // 商家无法在发货时传入单号 —— 属 04b-SCHEMA-REQUIREMENTS.md 记录的契约缺口,
        // 真正的「非空」要等 D2 补上字段。本用例只钉住「不写成 null」这半条。
        assertEquals("", tracking, "当前契约下无单号可写,应落成空串");
    }

    @Test
    @DisplayName("ADMIN 走 /merchant/** 会被授权层挡成 403(角色层先于对象层生效)")
    void adminIsBlockedFromMerchantNamespace() throws Exception {
        Integer orderId = seedOrderOfShop2();
        // AuthzRules 里 /merchant/** 只登记 SHOP,ADMIN 不在其中 —— 即 AccessGuard 那条
        // 「ADMIN 放行」分支在本路径上**不可达**。这里钉住的是「角色层先拦」这个事实。
        get("/merchant/orders/" + orderId, adminToken())
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("正向:ADMIN 在自己够得着的路径上不被对象层拦(AccessGuard 对 ADMIN 放行)")
    void adminPassesObjectLevelGuardOnAdminPaths() throws Exception {
        Integer orderId = seedOrderOfShop2();
        // /admin/orders/{id}/cancel → productOrderService.cancel → selectById → checkOrderOwner,
        // 这条路径 ADMIN 走得通,故能真正验证 AccessGuard 的 ADMIN 旁路没被写死。
        post("/admin/orders/" + orderId + "/cancel", adminToken(), Map.of())
                .andExpect(status().isOk());
        assertEquals("已取消", productOrderMapper.selectById(orderId).getStatus(),
                "ADMIN 应能取消任意订单(不受 shopId 归属限制)");
    }

    // ── 买家同样不能碰商家订单接口 ────────────────────────────────────────

    @Test
    @DisplayName("越权:USER 读商家订单详情 → 403(角色层与对象层双重拦截)")
    void userCannotReadMerchantOrderEndpoint() throws Exception {
        Integer orderId = seedOrderOfShop2();
        get("/merchant/orders/" + orderId, userToken())
                .andExpect(status().isForbidden());
    }
}
