package com.project.platform.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * <b>授权登记静态闸门</b> —— 防止「新端点漏登记 {@link AuthzRules}」这一类缺陷溜进主干。
 *
 * <h2>为什么需要它</h2>
 * <p>本项目是<b>默认拒绝</b>模型:没在 {@link AuthzRules} 登记的路径,对所有角色一律 403。
 * 新增端点时若忘了登记,后果是<b>前端页面静默 403</b> —— 而这种缺陷恰好是自动化测试的盲区:
 * <ul>
 *   <li>Playwright e2e 全部跑在 mock 模式({@code storageState} 注入
 *       {@code localStorage.RUNTIME_USE_MOCK='true'}),<b>永远不会打到后端</b>,
 *       所以「e2e 全绿」对漏登记<b>零感知</b>;</li>
 *   <li>而 {@code AuthzRulesTest} / {@code AuthorizationBaselineTest} 断言的是
 *       <b>手写清单</b>,新端点不会自动进入那些清单 —— 清单不会自己长大。</li>
 * </ul>
 * <p>于是形成了一个真实缺口:「实现了端点」与「端点被授权」之间没有任何自动化联系。
 * <b>本类就是补这个缺口</b>:它在测试期直接枚举 Spring 容器里<b>真实注册</b>的所有 handler 路径,
 * 逐条断言它要么已在 {@code AuthzRules} 登记、要么在 {@code SpringMvcConfig} 的显式白名单里。
 *
 * <h2>为什么这条闸门比看起来更重要</h2>
 * <p>本轮批次 1(D1/D2)预计新增 7+ 个端点({@code /merchant/wallet*}、{@code /admin/settings}、
 * {@code /merchant/settings}、{@code PUT /admin/reviews/{id}} 等)。每加一个就多一次漏登记的机会,
 * 而漏登记的表征是「页面某个按钮点了没反应、控制台一个 403」—— 极难定位。
 *
 * <h2>它怎么工作</h2>
 * <ol>
 *   <li>注入 {@link RequestMappingHandlerMapping},拿到容器里<b>全部</b>已注册 handler 的路径模式;</li>
 *   <li>把每条路径模式用 {@code AntPathMatcher} 与白名单、{@code AuthzRules} 逐条比对;</li>
 *   <li>任何一条既不匹配白名单、也不被 {@code AuthzRules} 覆盖 → 收集成失败清单并让测试失败,
 *       失败信息里直接写明「该端点会 403,请在 AuthzRules 登记或加入白名单」。</li>
 * </ol>
 *
 * <h2>维护须知</h2>
 * <p>本类<b>故意不维护</b>任何端点清单 —— 它的整个价值就在于「从容器里现取」,
 * 所以新增端点时<b>无需改动本文件</b>。若确有端点应当默认拒绝(例如刻意不开放的内部接口),
 * 那它就不该是 {@code @RestController} 暴露的 handler,或需要在本类的
 * {@link #INTENTIONALLY_UNREGISTERED} 中显式登记理由 —— 默认留空,任何豁免都要写明原因。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthzRegistrationGateTest {

    /**
     * 与 {@code SpringMvcConfig.excludePathPatterns} 一一对应的免登录白名单。
     * 这些路径<b>根本不进拦截器</b>,所以不要求在 {@code AuthzRules} 登记。
     */
    private static final List<String> PUBLIC_WHITELIST = List.of(
            "/common/login",
            "/common/register",
            "/common/sendResetCode",
            "/common/retrievePassword",
            "/products/**",
            "/search/**",
            "/merchants/**",
            // ⚠️ /checkout/summary 与 /checkout/promo 已于 TASK-002 按契约 C0 **移出白名单**。
            // 旧实现把二者放在这里 ⇒ LoginInterceptor 不跑 ⇒ CurrentUserThreadLocal 为空 ⇒
            // 券入口对**任何**请求(含合法登录态)恒 400「请先登录后再使用优惠码」(TASK-001 BLK-1)。
            // 现在它们的授权改由 AuthzRules 的 /checkout/** → USER 承担(匿名 401、登录 200)。
            // 若有人把这两行加回来,whitelistAndAuthzRulesDoNotOverlap 会立刻报冲突。
            // /payments/create 刻意不在白名单:创建支付需登录
            "/error"
    );

    /**
     * 刻意不授权、且有正当理由的路径。
     *
     * <p>默认应为空 —— 每加一条都要能回答「为什么这个端点存在却不该被任何角色访问」。
     * 若发现自己在往这里加东西以让测试变绿,那多半说明该端点<b>应该</b>被授权,
     * 而不是应该被豁免。
     *
     * <p><b>当前唯一一组豁免</b>:{@code ShoppingCartController} 下前端 0 引用的三个方法。
     * 理由见 {@code AuthzRules.java} 的对应注释与
     * {@code AuthorizationBaselineTest.unusedShoppingCartEndpointsAreDenied}:
     * <ul>
     *   <li>{@code /shoppingCart/list} 与 {@code /shoppingCart/selectById/{id}} ——
     *       前端从不调用,放行等于让任何买家读到<b>全表</b>购物车(含他人商品),故默认拒绝;</li>
     *   <li>{@code /shoppingCart/createOrder} —— 前端 0 引用,且它对传入的 {@code shoppingCartId}
     *       <b>没有归属校验</b>,直接放行会开出一个横向越权下单的口子,故默认拒绝。</li>
     * </ul>
     * 即:这三条是<b>「安全收口」的既成事实</b>,不是遗漏。闸门把它们记在这里并写明理由,
     * 是为了让「它们被拒绝」这件事<b>可见且可审计</b> —— 而不是让它们悄悄混过去。
     *
     * <p>⚠️ 治理提示:这三条是<b>僵尸端点</b> —— handler 仍注册着、却对所有角色恒 403。
     * 真正该做的是<b>物理删除</b>这三个方法(前端 0 引用),而不是长期靠授权表挡着。
     * 删除后本条豁免可一并清空。此事属后端范围,已上报总控。
     */
    private static final List<String> INTENTIONALLY_UNREGISTERED = List.of(
            "/shoppingCart/list",
            "/shoppingCart/selectById/**",
            "/shoppingCart/createOrder"
    );

    /**
     * **依赖登录态**的 controller 前缀 —— MIN-E6 的源码清单。
     *
     * <p>这些 controller 在方法体里直接解引用 {@code CurrentUserThreadLocal.getCurrentUser().getType()},
     * **没有 null 守卫**;因此它们的路径一旦进入 {@link #PUBLIC_WHITELIST},匿名请求就会 NPE → 500。
     * 清单由人工从源码抄录(出处逐条写在下面),用途见
     * {@code whitelistPathsMustNotDependOnLoginState()}。
     *
     * <p>当前白名单里**没有**任何路径落在这些前缀下,所以该断言是绿的 —— 它守的是**将来**。
     */
    private static final List<String> LOGIN_STATE_DEPENDENT_PREFIXES = List.of(
            "/productOrderEvaluate",   // ProductOrderEvaluateServiceImpl:32  getCurrentUser().getType()
            "/shippingAddress",        // ShippingAddressServiceImpl:26      同上
            "/shoppingCart",           // ShoppingCartServiceImpl:43         同上(注意 /shoppingCart 有 4 个在 AuthzRules 里)
            "/productOrder",           // ProductOrderServiceImpl:64         同上
            // 以下三条同样**无 null 守卫**(写法是"先取变量、紧接着解引用",性质相同),Review Gate 未逐条列名,纳入同一护栏:
            "/account",                // StorefrontAccountController:34/46/65/107  getCurrentUser().getNickname() 等
            "/coupons",                // CouponController:35/45                    getCurrentUser().getId()
            "/stock-alerts"            // StockAlertController:32/55/68             getCurrentUser().getId()
    );

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

    @Test
    @DisplayName("授权登记闸门:每个真实注册的端点,都必须已在 AuthzRules 登记或在显式白名单里")
    void everyRegisteredEndpointIsEitherRegisteredOrPublic() {
        final org.springframework.util.AntPathMatcher matcher = new org.springframework.util.AntPathMatcher();

        Set<String> allPatterns = collectHandlerPatterns();
        assertTrue(allPatterns.size() > 20,
                "只枚举到 " + allPatterns.size() + " 条路径,说明 handler 没取全,本闸门形同虚设");

        List<String> unregistered = new ArrayList<>();
        for (String pattern : new TreeSet<>(allPatterns)) {
            if (isPublic(pattern, matcher) || isIntentionallyUnregistered(pattern, matcher)) {
                continue;
            }
            if (!AuthzRules.isCovered(pattern)) {
                unregistered.add(pattern);
            }
        }

        if (!unregistered.isEmpty()) {
            fail("下列端点既不在 SpringMvcConfig 白名单、也未在 AuthzRules 登记 —— "
                    + "它们会对所有角色返回 403(前端表现为静默失败,而 Playwright e2e 跑在 mock 模式,测不出来):\n"
                    + "  - " + String.join("\n  - ", unregistered)
                    + "\n\n处理方式二选一:① 在 config/AuthzRules 登记路径 → 允许角色;"
                    + "② 若确实应公开,加进 SpringMvcConfig.excludePathPatterns;"
                    + "③ 若确实该默认拒绝,别把它做成 @RestController 端点。");
        }
    }

    @Test
    @DisplayName("授权登记闸门:白名单与 AuthzRules 不得重复登记同一路径(避免两处事实来源打架)")
    void whitelistAndAuthzRulesDoNotOverlap() {
        // 同一路径既在白名单又在规则表里,意味着「免登录」与「需登录且限角色」同时成立。
        // 结果取决于拦截器是否执行,属于脆弱的隐式依赖 —— 应当二选一。
        final org.springframework.util.AntPathMatcher matcher = new org.springframework.util.AntPathMatcher();
        Set<String> patterns = collectHandlerPatterns();
        List<String> overlapping = new ArrayList<>();
        for (String pattern : new TreeSet<>(patterns)) {
            if (matchesAny(pattern, PUBLIC_WHITELIST, matcher) && AuthzRules.isCovered(pattern)) {
                overlapping.add(pattern);
            }
        }
        if (!overlapping.isEmpty()) {
            fail("下列路径同时出现在白名单与 AuthzRules 中,授权语义冲突,请只保留一处:\n  - "
                    + String.join("\n  - ", overlapping));
        }
    }

    /**
     * 白名单路径**不得依赖登录态** —— MIN-E6 的护栏。
     *
     * <h2>为什么需要它</h2>
     * <p>白名单路径({@link #PUBLIC_WHITELIST})根本不进 {@code LoginInterceptor},因此
     * {@code CurrentUserThreadLocal} 为空。若某个 controller 在这些路径上直接解引用
     * {@code CurrentUserThreadLocal.getCurrentUser().getType()},**匿名请求就会 NPE → 500**。
     *
     * <p>Review Gate 指出当前有若干 service 方法这样写(如 {@code ShippingAddressServiceImpl}),
     * 它们**今天安全**——因为对应路径都在 {@code AuthzRules} 里(必须登录)。真正危险的是
     * **将来有人把某个路径挪进白名单**:那一刻就会变成 500,而现有两条闸门都**不会报警**
     * (不重叠闸门只查白名单∩规则表;登记闸门只查"有没有覆盖")。
     *
     * <h2>本断言怎么工作(执行性 tripwire)</h2>
     * <p>它枚举容器里真实注册的 handler,把「路径命中白名单」与「该路径落在依赖登录态的
     * controller 前缀下」两条**同时成立**的情形判为失败。维护者若把某个前缀挪进白名单,
     * 本用例立刻变红并指名道姓,修法二选一:
     * <ul>
     *   <li>在该 controller 里做 null 守卫(匿名可用的诚实降级,例如返空列表);或</li>
     *   <li>不要把它放进白名单。</li>
     * </ul>
     *
     * <p>⚠️ {@link #LOGIN_STATE_DEPENDENT_PREFIXES} 是**源码清单**(人工维护、注释给出处)。
     * 它的价值不在于"自动发现",而在于把散在 4 个 service 里的隐式前提变成**一条可执行的不变式**;
     * 当前白名单里没有任何路径落在这些前缀下,所以断言应当是绿的。
     */
    @Test
    @DisplayName("授权登记闸门:白名单路径不得落在依赖登录态的 controller 前缀下(否则匿名 → NPE → 500)")
    void whitelistPathsMustNotDependOnLoginState() {
        final org.springframework.util.AntPathMatcher matcher = new org.springframework.util.AntPathMatcher();
        List<String> offenders = new ArrayList<>();
        for (String pattern : new TreeSet<>(collectHandlerPatterns())) {
            if (!matchesAny(pattern, PUBLIC_WHITELIST, matcher)) {
                continue; // 只关心白名单路径
            }
            for (String prefix : LOGIN_STATE_DEPENDENT_PREFIXES) {
                if (pattern.equals(prefix) || pattern.startsWith(prefix + "/")) {
                    offenders.add(pattern + "   (落在依赖登录态的 " + prefix + " 下)");
                }
            }
        }
        if (!offenders.isEmpty()) {
            fail("下列**白名单**路径落在了依赖登录态的 controller 下。白名单不进 LoginInterceptor,"
                    + "CurrentUserThreadLocal 为空 ⇒ 匿名请求会 NPE → 500:\n  - "
                    + String.join("\n  - ", offenders)
                    + "\n\n处理方式二选一:① 在该 controller 里对 getCurrentUser() 做 null 守卫"
                    + "(匿名走诚实的空结果/降级);② 不要把它放进白名单。");
        }
    }

    // ─────────────────────────── helpers ───────────────────────────

    /** 从容器里取出所有已注册 handler 的路径模式(类级 + 方法级,取并集) */
    private Set<String> collectHandlerPatterns() {
        Set<String> patterns = new LinkedHashSet<>();
        for (RequestMappingInfo info : handlerMapping.getHandlerMethods().keySet()) {
            if (info.getPathPatternsCondition() == null) {
                continue;
            }
            info.getPathPatternsCondition().getPatterns()
                    .forEach(p -> patterns.add(p.getPatternString()));
        }
        return patterns;
    }

    private boolean isPublic(String pattern, org.springframework.util.AntPathMatcher matcher) {
        return matchesAny(pattern, PUBLIC_WHITELIST, matcher);
    }

    private boolean isIntentionallyUnregistered(String pattern, org.springframework.util.AntPathMatcher matcher) {
        return matchesAny(pattern, INTENTIONALLY_UNREGISTERED, matcher);
    }

    private boolean matchesAny(String pattern, List<String> candidates,
                               org.springframework.util.AntPathMatcher matcher) {
        for (String candidate : candidates) {
            // 精确匹配,或以 "/**" 结尾的前缀覆盖
            if (pattern.equals(candidate)) {
                return true;
            }
            if (candidate.endsWith("/**")) {
                String prefix = candidate.substring(0, candidate.length() - 3);
                if (pattern.equals(prefix) || pattern.startsWith(prefix + "/")) {
                    return true;
                }
            }
            if (matcher.match(candidate, pattern)) {
                return true;
            }
        }
        return false;
    }

    /** 供人工排查用:打印全部端点(失败信息里已包含,这里保证 HandlerMethod 引用不被误删) */
    @SuppressWarnings("unused")
    private String describe(Object handler) {
        return handler instanceof HandlerMethod hm ? hm.getMethod().toString() : String.valueOf(handler);
    }
}
