package com.project.platform.dto;

import lombok.Data;

/**
 * 订阅到货提醒(POST /stock-alerts)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应,**不加新校验**,行为不变。
 */
@Data
public class StockAlertSubscribeDTO {
    private Integer productId;
    private String productTitle;
    private String productImage;
    private String email;
}
