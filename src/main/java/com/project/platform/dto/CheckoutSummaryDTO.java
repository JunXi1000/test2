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
 * <p>字段与既有实现从请求体里读的 key 一一对应,**不加新校验**。原有校验
 * (「结算商品参数不合法」/「商品不存在或已下架」,均为 409)仍留在控制器里。
 */
@Data
public class CheckoutSummaryDTO {

    private List<Item> items;

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
