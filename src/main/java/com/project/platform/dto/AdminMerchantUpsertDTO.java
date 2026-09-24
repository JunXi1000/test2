package com.project.platform.dto;

import lombok.Data;

/**
 * 管理端新建/更新商家(POST /admin/merchants、PUT /admin/merchants/{id})的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。**不加新校验** —— 注意既有实现本就**一处校验都没有**,
 * 而 `shop` 表除主键外全部可空,所以缺字段会静默建出 name/nickname/email/username 全为 null 的商家行。
 * 是否补必填校验属业务决策,留给 Phase 4。
 *
 * <p>另两处既有行为如实保留(未改):
 * <ul>
 *   <li>新建时 {@code username} 直接取 {@code email} 的值,密码硬编码为 {@code "123456"};</li>
 *   <li>更新时用 {@code containsKey} 判断,换成 DTO 后 null 即视为不更新。</li>
 * </ul>
 */
@Data
public class AdminMerchantUpsertDTO {
    private String storeName;
    private String ownerName;
    private String email;
}
