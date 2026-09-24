package com.project.platform.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link AuthzRules} 的纯单测 —— 不起 Spring 上下文,毫秒级。
 *
 * 本类把「放行清单的依据」固化成断言:前端真实调用面必须放行、前端 0 引用的遗留端点
 * 必须默认拒绝、角色不得跨域。改 {@link AuthzRules} 时这些断言会立刻告诉你打破了哪一条。
 *
 * 注意这里**只**覆盖角色规则。公开(免登录)路径由
 * {@code SpringMvcConfig.excludePathPatterns} 声明,不在本表,故本类不断言它们。
 */
class AuthzRulesTest {

    private static final String[] ALL_ROLES = {AuthzRules.USER, AuthzRules.SHOP, AuthzRules.ADMIN};

    @Test
    @DisplayName("默认拒绝:未登记的遗留端点对任何角色都不放行")
    void unlistedPathsAreDeniedForEveryRole() {
        String[] denied = {
                // 遗留 CRUD(前端 0 引用)
                "/product/list", "/product/delBatch", "/product/update",
                "/productType/list", "/productType/delBatch",
                "/slideshow/list", "/slideshow/delBatch",
                "/advertising/list", "/advertising/delBatch",
                "/shop/list", "/shop/delBatch",
                "/shippingAddress/list", "/shippingAddress/selectById/1", "/shippingAddress/delBatch",
                "/productCollect/list", "/productCollect/delBatch",
                "/shopCollect/list", "/shopCollect/delBatch",
                "/productBrowsingHistory/list", "/productBrowsingHistory/delBatch",
                "/productOrder/list", "/productOrder/cancel/1",
                "/productOrderEvaluate/list", "/productOrderEvaluate/delBatch",
                "/user/list", "/admin-accounts/page",
                "/statisticalReportForms/productTypeProportionOfChar",
                // 购物车同 Controller 下前端不调用的三个
                "/shoppingCart/selectById/1", "/shoppingCart/list", "/shoppingCart/createOrder"
        };
        for (String path : denied) {
            for (String role : ALL_ROLES) {
                assertFalse(AuthzRules.isAllowed(path, role),
                        path + " 未登记,应对 " + role + " 拒绝 —— 若它被放行,说明规则表开得太宽");
            }
        }
    }

    @Test
    @DisplayName("前缀误命中已消除:/admin/** 不再命中 /admin-accounts,/productOrder/** 不再命中 /productOrderEvaluate")
    void segmentMatchingRemovesPrefixCollisions() {
        // 这正是改掉 String.startsWith 的动机:两处无关控制器曾被顺带门控
        assertTrue(AuthzRules.isCovered("/admin/users"));
        assertFalse(AuthzRules.isCovered("/admin-accounts/page"), "/admin/** 是路径段匹配,不该命中 /admin-accounts");
        assertFalse(AuthzRules.isCovered("/productOrderEvaluate/list"), "/productOrder/** 不该命中 /productOrderEvaluate");
        assertFalse(AuthzRules.isCovered("/productOrder/list"));
    }

    @Test
    @DisplayName("AntPathMatcher 的 /x/** 也匹配裸 /x —— 放行清单依赖这个行为")
    void doubleStarMatchesBarePath() {
        // 若这条不成立,GET /orders(前端主链路)会被误拒
        assertTrue(AuthzRules.isAllowed("/orders", AuthzRules.USER));
        assertTrue(AuthzRules.isAllowed("/orders/recent", AuthzRules.USER));
        assertTrue(AuthzRules.isAllowed("/orders/NO123/cancel", AuthzRules.USER));
        assertTrue(AuthzRules.isAllowed("/notifications", AuthzRules.SHOP));
        assertTrue(AuthzRules.isAllowed("/chat/conversations", AuthzRules.SHOP));
        assertTrue(AuthzRules.isAllowed("/addresses", AuthzRules.USER));
        assertTrue(AuthzRules.isAllowed("/admin", AuthzRules.ADMIN));
    }

    @Test
    @DisplayName("前端真实调用面逐条放行(依据:web/src/api/modules 与各域页面 import)")
    void frontendSurfaceIsAllowed() {
        String[] userPaths = {
                "/account/profile", "/account/notifications",
                "/addresses", "/addresses/1", "/addresses/1/default",
                "/dashboard/stats", "/orders", "/orders/recent", "/orders/NO1/cancel",
                "/coupons", "/coupons/1/claim", "/coupons/my-coupons",
                "/returns", "/stock-alerts/mine", "/stock-alerts/1",
                "/shoppingCart/page", "/shoppingCart/add", "/shoppingCart/update", "/shoppingCart/delBatch",
                "/payments/create", "/payments/confirm", "/payments/complete-action",
                "/common/currentUser", "/common/updatePassword", "/file/upload"
        };
        for (String path : userPaths) {
            assertTrue(AuthzRules.isAllowed(path, AuthzRules.USER), "买家应可访问 " + path);
        }

        String[] shopPaths = {
                "/merchant/products", "/merchant/products/1", "/merchant/orders",
                "/merchant/orders/1", "/merchant/orders/1/status",
                "/merchant/dashboard/stats", "/merchant/dashboard/low-stock",
                "/merchant/wallet", "/merchant/wallet/transactions", "/merchant/wallet/withdraw",
                "/merchant/settings",
                // 买卖双方共用
                "/chat/conversations", "/chat/conversations/1/messages", "/chat/conversations/1/read",
                "/chat/messages", "/notifications", "/notifications/1/read", "/file/upload"
        };
        for (String path : shopPaths) {
            assertTrue(AuthzRules.isAllowed(path, AuthzRules.SHOP), "商家应可访问 " + path);
        }

        String[] adminPaths = {
                "/admin/dashboard/stats", "/admin/dashboard/recent-users", "/admin/dashboard/revenue-chart",
                "/admin/users", "/admin/users/1", "/admin/users/1/toggle-status", "/admin/users/1/reset-password",
                "/admin/merchants", "/admin/merchants/1", "/admin/merchants/1/approve", "/admin/merchants/1/reject",
                "/admin/products", "/admin/products/1/ban",
                "/admin/orders", "/admin/orders/1/cancel",
                "/admin/reviews", "/admin/reviews/1", "/admin/settings",
                "/notifications", "/notifications/read-all", "/common/resetPassword", "/file/upload"
        };
        for (String path : adminPaths) {
            assertTrue(AuthzRules.isAllowed(path, AuthzRules.ADMIN), "管理端应可访问 " + path);
        }
    }

    @Test
    @DisplayName("角色不得跨域")
    void rolesCannotCrossDomains() {
        // 商家后台只给 SHOP
        assertFalse(AuthzRules.isAllowed("/merchant/products", AuthzRules.USER));
        assertFalse(AuthzRules.isAllowed("/merchant/products", AuthzRules.ADMIN));
        // 管理后台只给 ADMIN
        assertFalse(AuthzRules.isAllowed("/admin/users", AuthzRules.SHOP));
        assertFalse(AuthzRules.isAllowed("/admin/users", AuthzRules.USER));
        // 买家端点不给商家/管理端
        assertFalse(AuthzRules.isAllowed("/orders", AuthzRules.SHOP));
        assertFalse(AuthzRules.isAllowed("/orders", AuthzRules.ADMIN));
        assertFalse(AuthzRules.isAllowed("/shoppingCart/add", AuthzRules.SHOP));
        assertFalse(AuthzRules.isAllowed("/addresses", AuthzRules.ADMIN));
        // 会话只有买卖双方(管理端没有消息页)
        assertFalse(AuthzRules.isAllowed("/chat/conversations", AuthzRules.ADMIN));
    }

    @Test
    @DisplayName("null 与未知角色一律拒绝(默认拒绝的兜底)")
    void nullsAndUnknownRolesAreDenied() {
        assertFalse(AuthzRules.isAllowed("/orders", null));
        assertFalse(AuthzRules.isAllowed(null, AuthzRules.USER));
        assertFalse(AuthzRules.isAllowed("/orders", "SUPERADMIN"));
        assertFalse(AuthzRules.isCovered(null));
    }
}
