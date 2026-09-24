package com.project.platform.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 提交退货申请(POST /returns)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应 —— 本次只把「裸 JSONObject + 逐个 getString」
 * 换成有类型的入参,**不加任何新校验**,故行为不变(现有校验若有,仍留在控制器里)。
 *
 * <p>⚠️ 已知缺口(未在本次改动范围):`orderId` 目前**不校验是否属于当前用户**,
 * `refundAmount` 也由客户端给且无上限 —— 而前端 `pages/dashboard/Returns.vue` 的订单号是
 * **手输文本框**(无订单选择器),故补校验会改变用户可见行为,需与前端一起改。
 */
@Data
public class ReturnRequestCreateDTO {
    private String orderId;
    private String productTitle;
    private String productImage;
    private String reason;
    private String detail;
    /** 缺省按 0 处理(与既有实现一致) */
    private BigDecimal refundAmount;
}
