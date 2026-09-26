package com.project.platform.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 管理端新建/更新商家(POST /admin/merchants、PUT /admin/merchants/{id})的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。
 *
 * <p><b>2026-09-26 补上校验</b>:此前**一处校验都没有**,而 `shop` 表除主键外全部可空,
 * 于是缺字段会静默建出 name/nickname/email/username 全为 null 的商家行。按常规做法补
 * {@code @NotBlank}/{@code @Email},走 Bean Validation → 400(与其它 DTO 一致)。
 *
 * <p>注意更新端点(PUT)复用本 DTO,但那里是**部分更新**(null 表示不改)—— 故控制器对 PUT
 * **不加** {@code @Valid},只对新建(POST)校验必填。
 */
@Data
public class AdminMerchantUpsertDTO {

    @NotBlank(message = "店铺名称不能为空")
    private String storeName;

    @NotBlank(message = "店主名称不能为空")
    private String ownerName;

    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;
}
