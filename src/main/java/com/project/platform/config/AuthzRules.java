package com.project.platform.config;

import org.springframework.util.AntPathMatcher;

import java.util.List;
import java.util.Set;

/**
 * 授权规则表(单一事实来源):路径模式 → 允许的角色集合。
 *
 * <p><b>语义是「默认拒绝」</b> —— 未命中任何规则的路径一律拒绝(403)。这是有意为之:
 * 此前 {@code LoginInterceptor.checkRole} 是「默认放行」(只对 4 个前缀判角色,其余
 * {@code return true}),导致约 80 个前端不调用的遗留 CRUD 端点对任意登录用户开放;
 * 且因 {@code String.startsWith} 做前缀匹配而误命中两处无关控制器
 * ({@code /admin} 命中 {@code /admin-accounts}、{@code /productOrder} 命中
 * {@code /productOrderEvaluate})。
 *
 * <p><b>按路径段匹配</b>({@link AntPathMatcher}),所以 {@code /admin/**} 不会命中
 * {@code /admin-accounts} —— 前缀误命中这一类问题从机制上消失。
 *
 * <p><b>公开(免登录)路径不在本表</b>:它们由
 * {@code SpringMvcConfig.excludePathPatterns} 声明,那些路径根本不会进入拦截器。
 *
 * <p><b>放行清单的取证依据(两条,缺一不可)</b>:
 * <ol>
 *   <li>前端真实调用面:{@code web/src/api/modules/*.ts} 以及各域页面实际 import 的模块;</li>
 *   <li>既有测试断言的角色语义:{@code src/test/java/.../controller/*Test.java}。</li>
 * </ol>
 * 改动本表时必须同时核对这两处,否则会出现「前端某个页面静默 403」或「既有测试变红」。
 *
 * @see com.project.platform.interceptor.LoginInterceptor
 */
public final class AuthzRules {

    public static final String USER = "USER";
    public static final String SHOP = "SHOP";
    public static final String ADMIN = "ADMIN";

    /** 三种角色都允许 —— 用于角色由 token 决定、服务层再按 type 分派的通用端点 */
    private static final Set<String> ALL_ROLES = Set.of(USER, SHOP, ADMIN);

    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    private record Rule(String pattern, Set<String> roles) {
    }

    /**
     * 规则按**声明顺序**求值,首个命中者决定结果。新增规则时注意别让宽规则遮住窄规则。
     */
    private static final List<Rule> RULES = List.of(
            // ── 通用:登录即可(服务层按 token 里的 type 分派) ──
            new Rule("/common/currentUser", ALL_ROLES),
            new Rule("/common/updateCurrentUser", ALL_ROLES),
            new Rule("/common/updatePassword", ALL_ROLES),
            // CommonController 内部另有 ADMIN 校验,这里再收一道
            new Rule("/common/resetPassword", Set.of(ADMIN)),

            // ── 文件:上传需登录;图片 GET 由 LoginInterceptor 提前放行,不走本表 ──
            new Rule("/file/**", ALL_ROLES),

            // ── 买家 ──
            new Rule("/account/**", Set.of(USER)),
            new Rule("/addresses/**", Set.of(USER)),
            new Rule("/coupons/**", Set.of(USER)),
            new Rule("/dashboard/**", Set.of(USER)),
            new Rule("/orders/**", Set.of(USER)),
            new Rule("/payments/**", Set.of(USER)),
            new Rule("/returns/**", Set.of(USER)),
            new Rule("/stock-alerts/**", Set.of(USER)),

            // 购物车**只放行前端实际调用的 4 个端点**。同 Controller 下的
            // selectById / list / createOrder 前端 0 引用,其中 createOrder 对传入的
            // shoppingCartId 无归属校验,故刻意不入表 → 默认拒绝。
            new Rule("/shoppingCart/page", Set.of(USER)),
            new Rule("/shoppingCart/add", Set.of(USER)),
            new Rule("/shoppingCart/update", Set.of(USER)),
            new Rule("/shoppingCart/delBatch", Set.of(USER)),

            // ── 通知:三种角色都有通知(schema 里 notification.role 的取值即 ADMIN/SHOP/USER;
            //          前端消费者是商家的 useMerchantNotifications 与管理端的 Notifications 页) ──
            new Rule("/notifications/**", ALL_ROLES),

            // ── 会话:买卖双方共用(前端 ChatWidget + useChatConversations 被两个域复用) ──
            new Rule("/chat/**", Set.of(USER, SHOP)),

            // ── 商家后台 ──
            new Rule("/merchant/**", Set.of(SHOP)),

            // ── 管理后台 ──
            new Rule("/admin/**", Set.of(ADMIN))

            // 以下路径**刻意没有规则**,即默认拒绝:
            //   /product/**            /productType/**        /slideshow/**
            //   /advertising/**        /shop/**               /shippingAddress/**
            //   /productCollect/**     /shopCollect/**        /productBrowsingHistory/**
            //   /productOrder/**       /productOrderEvaluate/**  /user/**
            //   /admin-accounts/**     /statisticalReportForms/**
            //   /shoppingCart/selectById/**  /shoppingCart/list  /shoppingCart/createOrder
            //
            // 2026-09-24 起:上述前缀对应的 14 个「遗留 CRUD」控制器已**物理删除**(约 90 个端点),
            // 所以这些路径现在根本没有处理器 —— 请求仍会被本表的默认拒绝挡下(匿名 401 / 已登录 403),
            // 与删除前的外部表现一致。仅 /shoppingCart 的 3 个未登记端点其控制器仍在(另 4 个在用端点见上)。
    );

    private AuthzRules() {
    }

    /**
     * 该路径对该角色是否放行。
     *
     * @param path 请求 URI(不含 context path,与 {@code HttpServletRequest.getRequestURI()} 一致)
     * @param role token 里的用户类型(USER / SHOP / ADMIN),为 null 视为不放行
     * @return true 表示放行;false 表示应拒绝 —— **未命中规则也返回 false**
     */
    public static boolean isAllowed(String path, String role) {
        if (path == null || role == null) {
            return false;
        }
        for (Rule rule : RULES) {
            if (MATCHER.match(rule.pattern(), path)) {
                return rule.roles().contains(role);
            }
        }
        return false;
    }

    /** 供测试与排障使用:该路径是否被任何规则覆盖(未覆盖即为默认拒绝) */
    public static boolean isCovered(String path) {
        if (path == null) {
            return false;
        }
        for (Rule rule : RULES) {
            if (MATCHER.match(rule.pattern(), path)) {
                return true;
            }
        }
        return false;
    }
}
