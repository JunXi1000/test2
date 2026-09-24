package com.project.platform.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 应用优惠码(POST /checkout/promo)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。`code` 为空时控制器已抛
 * 400「优惠码不能为空」(Phase 3c 补的,替换掉此前的 NPE → 500)。
 *
 * <p>⚠️ **未修的同源缺陷**:`subtotal` 缺失时,下游
 * {@code CouponServiceImpl.applyByCode} 与回退分支都会对它做乘法 → **NPE → 500**。
 * 修它属「新增必填约束」(subtotal 是运算必需项),与本次「只固化现有校验」的定调冲突,
 * 故**记录在案、暂不修**,已列入 Phase 3 的输入校验缺口清单。
 */
@Data
public class CheckoutPromoDTO {
    private String code;
    private BigDecimal subtotal;
}
