package com.project.platform.dto;

import lombok.Data;

import java.util.List;

/**
 * 结算摘要(POST /checkout/summary)的入参。
 *
 * <p>金额一律以 DB 价格为准,故此入参**只描述商品与数量**。
 * 前端 `checkout.ts` 还会发 `zip`,属未知字段,反序列化时被忽略
 * (与既有 {@link StorefrontCheckoutDTO} 忽略 `price` 等字段同一约定)。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应,**不加新校验**。原有校验仍留在控制器里,
 * 状态码口径于 2026-10-02 裁决(BLK-3,定为 <b>400</b> 而非 409 —— 400 是请求参数错误的
 * 标准语义,409 表示「与资源当前状态冲突」,此处没有任何资源状态参与判断):
 * <ul>
 *   <li>「结算商品不能为空」({@code items} 缺失/为空)→ <b>400</b>;</li>
 *   <li>「结算商品参数不合法」(缺 productId/id、quantity ≤ 0)→ <b>400</b>;</li>
 *   <li>「商品不存在或已下架」→ <b>404</b>(商品这一资源不存在,语义是 404 而非 4xx-参数错)。</li>
 * </ul>
 */
@Data
public class CheckoutSummaryDTO {

    private List<Item> items;

    /**
     * 可选的优惠码(2026-09-27 新增)。
     *
     * <p>不传 → {@code discount=0}、{@code total=subtotal}。
     * 传了 → 走 {@code CouponService.applyByCode} 的完整校验(归属 / 有效期 / 已用 / 门槛),
     * 任一不满足即 400,不会静默按 0 处理。
     *
     * <p>加这个字段是为了让
     * {@code summary.total} 与 {@code /payments/create} 的 {@code amount} 在
     * <b>用了优惠码的情况下也对得上</b>(AC-04.2)。此前 summary 收不到码,
     * 两者在有优惠时必然不等。
     */
    private String code;

    @Data
    public static class Item {
        private Integer productId;
        /** 兼容前端 CartItem:productId 优先,缺省回落 id */
        private Integer id;
        private Integer quantity;

        /** 与既有实现一致:productId 优先,缺省回落 id */
        public Integer resolveProductId() {
            return productId != null ? productId : id;
        }
    }
}
