package com.project.platform.controller;

import com.project.platform.dto.CheckoutPromoDTO;
import com.project.platform.dto.CheckoutSummaryDTO;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.Product;
import com.project.platform.exception.CustomException;
import com.project.platform.service.CouponService;
import com.project.platform.service.ProductService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Checkout API — matches frontend's expected /checkout contract.
 *
 * <p><b>诚信原则(2026-09-27 TASK-000-I)</b>:本控制器返回的每个金额都必须是
 * <b>真正会被扣的钱</b>。此前的实现返回
 * {@code total = subtotal + shipping + tax - 满减},而 {@code /payments/create}
 * 实际按 {@code DB 价 × 数量} 落单 —— 运费、税、满减三项<b>都不入账</b>。
 * 于是买家结算页看到的应付总额与实际扣款对不上,差额还不小(满 200 免邮 + 8% 税能差出十几块)。
 *
 * <p>现在的口径:
 * <ul>
 *   <li><b>运费 / 税 一律不出现在应付总额里</b> —— 运费模板在本项目里根本不存在,
 *       返回一个编造的运费数字比不返回更糟(总控裁定)。相应字段已从响应中<b>移除</b>,
 *       不是置 0,免得前端渲染出一行「运费 ¥0.00」。</li>
 *   <li><b>优惠只认 coupon 表</b>,且必须校验归属 / 有效期 / 是否已用 / 门槛。
 *       硬编码的 SAVE10(10%)/VIP15(15%) 已删除 —— 它们在 coupon 表里没有记录,
 *       无券可核销、可无限次重复使用。</li>
 *   <li>{@code total == /payments/create} 的 {@code amount} == DB 订单行 {@code total_money} 之和。</li>
 * </ul>
 */
@RestController
@RequestMapping("/checkout")
public class StorefrontCheckoutController {

    @Resource
    private ProductService productService;

    @Resource
    private CouponService couponService;

    /**
     * POST /checkout/summary — 结算金额汇总(服务端校验)。
     *
     * <p>金额一律以 DB {@code product.price} 重算,<b>绝不信任前端传入的 price</b>。
     *
     * <p><b>鉴权(2026-10-02 变更)</b>:本端点<b>需要登录</b>。此前它在
     * {@code SpringMvcConfig.excludePathPatterns} 白名单里,拦截器不执行 ⇒
     * {@code CurrentUserThreadLocal} 恒空 ⇒ 带 {@code code} 的请求对<b>已登录用户也</b>
     * 报 400「请先登录后再使用优惠码」(白名单是全有或全无,没有「可选鉴权」这一档)。
     * 现在由白名单移入 {@code AuthzRules} 的 {@code /checkout/**} 规则:匿名 → 401。
     *
     * <p><b>响应结构(2026-09-27 变更,前端需同步)</b>:
     * <pre>
     * {
     *   "subtotal":     198.00,   // DB 价 × 数量 之和
     *   "discount":       0.00,   // 仅 coupon 表校验通过的优惠
     *   "discountCode":  null,    // 命中的券码;未传/未命中为 null
     *   "total":       198.00    // = subtotal - discount
     * }
     * </pre>
     * <b>已移除</b> {@code shipping} / {@code tax} / 满减档位。前端请删除这三处渲染,
     * 不要把它们当成 0 继续显示。
     *
     * <p><b>状态码口径(2026-10-02 裁决)</b>:
     * <ul>
     *   <li>400 —— {@code items} 缺失/为空(「结算商品不能为空」),以及商品项参数不合法
     *       (缺 productId/id 或 quantity ≤ 0,「结算商品参数不合法」)。
     *       <b>不再用 409</b>:400 是请求参数错误的标准语义,409 表示「与资源当前状态冲突」,
     *       这里没有任何资源状态参与判断;</li>
     *   <li>404 —— 商品不存在或已下架(「商品不存在或已下架」)。</li>
     * </ul>
     *
     * @param body 可选 {@code code}:带优惠码时 total 已扣减;未带则 discount=0
     */
    @PostMapping("/summary")
    public ResponseVO<Map<String, Object>> calculateSummary(@RequestBody CheckoutSummaryDTO body) {
        BigDecimal subtotal = BigDecimal.ZERO;
        List<CheckoutSummaryDTO.Item> items = body.getItems();
        // 空/缺 items 此前会静默按 subtotal=0 返回 200 —— 一个"合法"的零元结算摘要。
        // 按常规做法:没有商品就没有结算可言,直接 400。
        if (items == null || items.isEmpty()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "结算商品不能为空");
        }
        for (CheckoutSummaryDTO.Item item : items) {
            // 兼容前端 CartItem:productId 优先,缺省回落 id(DTO 里 resolveProductId 封装同一规则)
            Integer productId = item.resolveProductId();
            Integer qty = item.getQuantity();
            // 原实现用 getIntValue 读数量(缺失得 0),故「缺失」与「<=0」同样拒绝
            if (productId == null || qty == null || qty <= 0) {
                throw new CustomException(HttpStatus.BAD_REQUEST, "结算商品参数不合法");
            }
            Product product = productService.selectById(productId);
            if (product == null) {
                throw new CustomException(HttpStatus.NOT_FOUND, "商品不存在或已下架");
            }
            subtotal = subtotal.add(product.getPrice().multiply(BigDecimal.valueOf(qty)));
        }

        // 优惠:只认 coupon 表,且必须通过归属 / 有效期 / 已用 / 门槛四项校验。
        // 未带 code 时 discount 恒为 0 —— 不再有任何「满减自动折扣」。
        BigDecimal discount = BigDecimal.ZERO;
        String discountCode = null;
        if (body.getCode() != null && !body.getCode().isBlank()) {
            Map<String, Object> coupon = couponService.applyByCode(
                    body.getCode(), subtotal, currentUserId());
            discount = (BigDecimal) coupon.get("discount");
            discountCode = (String) coupon.get("code");
        }
        // 封顶:即便 service 层漏了,total 也不得为负(负数订单会让退款变成反向加钱)
        if (discount.compareTo(subtotal) > 0) {
            discount = subtotal;
        }
        BigDecimal total = subtotal.subtract(discount).setScale(2, RoundingMode.HALF_UP);

        Map<String, Object> result = new HashMap<>();
        result.put("subtotal", subtotal.setScale(2, RoundingMode.HALF_UP));
        result.put("discount", discount);
        result.put("discountCode", discountCode);
        result.put("total", total);
        return ResponseVO.ok(result);
    }

    /**
     * POST /checkout/promo — 校验优惠码并返回折扣额(**只读,不核销**)。
     *
     * <p>真正的核销发生在 {@code /payments/create} 落单时(见
     * {@code CouponService.redeem}),避免用户在结算页反复试码就把券用掉。
     *
     * <p><b>鉴权(2026-10-02 变更)</b>:本端点<b>需要登录</b>,匿名一律 **401**
     * (由 {@code LoginInterceptor} 统一产生,不再是应用层的 400)。此前它在白名单里、
     * 拦截器不执行 ⇒ {@code currentUserId()} 恒 null ⇒ 对<b>任何</b>请求(含合法登录态)
     * 都报 400「请先登录后再使用优惠码」,券入口在真实链路上完全不可用。
     *
     * <p>错误码:
     * <ul>
     *   <li>400 优惠码为空 / 金额为空 / 优惠码无效(不存在·下架·过期)/ 未领取 / 已使用</li>
     *   <li>409 未达使用门槛(沿用既有错误码,不改动契约)</li>
     *   <li>401 未登录 —— 由 {@code LoginInterceptor} 在进入本方法**之前**产生;
     *       service 层仍保留 {@code userId == null} 的兜底拒绝(直连服务时的防线)</li>
     * </ul>
     */
    @PostMapping("/promo")
    public ResponseVO<Map<String, Object>> applyPromo(@RequestBody CheckoutPromoDTO body) {
        String code = body.getCode();
        BigDecimal subtotal = body.getSubtotal();
        // 缺 code 时原实现会在下面的 code.toUpperCase() 抛 NPE → 500。请求不合法应当是 400。
        if (code == null || code.isBlank()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "优惠码不能为空");
        }
        // 同理:subtotal 缺失时下游会 NPE → 500。两条路径都要用它算折扣,故它是真正的必填项。
        if (subtotal == null) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "结算金额不能为空");
        }

        // 未命中一律 400「优惠码无效」,**不再回退到硬编码的 SAVE10 / VIP15**。
        // 那两个码在 coupon 表里没有记录:无券可核销、无使用记录、可无限次重复使用。
        Map<String, Object> coupon = couponService.applyByCode(code, subtotal, currentUserId());

        // 只回前端契约里的字段。applyByCode 的结果里还有 couponIdRaw / userCouponId
        // 两个**服务端内部用**的键(核销时要按主键查 user_coupon),不能泄漏出去。
        Map<String, Object> result = new HashMap<>();
        result.put("discount", coupon.get("discount"));
        result.put("couponId", coupon.get("couponId"));
        result.put("code", coupon.get("code"));
        result.put("title", coupon.get("title"));
        result.put("type", coupon.get("type"));
        return ResponseVO.ok(result);
    }

    /**
     * 当前登录用户 id。
     *
     * <p>本控制器的两个端点都已在 {@code AuthzRules} 登记为「需登录」,拦截器先行放行
     * 才会进到这里,故 {@code CurrentUserThreadLocal} 正常有值。仍保留 null 分支:
     * 一是窄化「忘了登记 / 有人又把它塞回白名单」时的失败模式(返回 null 由
     * {@code CouponService} 明确拒绝,而不是 NPE → 500),二是对控制器单测友好。
     */
    private Integer currentUserId() {
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        return current == null ? null : current.getId();
    }
}
