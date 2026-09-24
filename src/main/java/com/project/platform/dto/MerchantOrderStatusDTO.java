package com.project.platform.dto;

import lombok.Data;

/**
 * 商家端更新订单状态(PUT /merchant/orders/{id}/status)的入参。
 *
 * <p>此前这里用 {@code switch (status)} 且**没有 default**:{@code status} 缺失时为 null,
 * `switch` 对 null 抛 NPE → 500。控制器现在显式拦下 null 并返回 400。
 *
 * <p>⚠️ 未改的既有语义:`status` 是**未知值**时 switch 不匹配,会原样回写订单、静默返回 200
 * (no-op)。这属业务语义问题(应拒绝还是忽略),留给 Phase 4,不在本次「只固化现有校验」范围内。
 */
@Data
public class MerchantOrderStatusDTO {
    /** processing / shipped / delivered / cancelled */
    private String status;
}
