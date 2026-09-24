package com.project.platform.dto;

import lombok.Data;

/**
 * 更新买家资料(POST /account/profile)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。**不加新校验**,但有两处**行为差异**是本次
 * 「从 Map 换成 DTO」带来的,需知晓:
 *
 * <ul>
 *   <li>既有实现用 {@code containsKey} 判断「是否要更新该字段」,所以显式传
 *       {@code "phone": null} 会把电话**置空**;换成 DTO 后 null 与「未传」不可区分,
 *       一律视为**不更新**。前端 `account.ts` 每次发送完整对象(非 null),故此差异在实践中不可观测,
 *       且「显式 null 不置空」更符合资料更新的直觉。</li>
 *   <li>既有实现把取到的值 {@code (String)} 强转,请求体传数字会 **ClassCastException → 500**;
 *       换成 {@code String} 字段后由反序列化器把数字**强转成字符串**,该 500 自然消失
 *       (无需新增校验规则)。</li>
 * </ul>
 *
 * <p>{@code lastName} 字段被保留:既有实现只对它做 {@code containsKey` 判断而从不读取其值
 * (即「传了 lastName 会触发更新分支但改的是 nickname 的原值」)。为**不改行为**,这里保留该字段
 * 并在控制器里沿用同样的判断。
 */
@Data
public class AccountProfileDTO {
    private String firstName;
    private String lastName;
    private String phone;
    private String avatar;
}
