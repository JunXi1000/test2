package com.project.platform.dto;

import lombok.Data;

/**
 * 管理端更新用户(PUT /admin/users/{id})的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。既有实现用 {@code containsKey} 判断是否更新,
 * 换成 DTO 后 null 即视为不更新(显式 null 不再置空 —— 与 {@code AccountProfileDTO} 同一取舍)。
 *
 * <p>{@code (String)} 强转已去掉:传数字不再 `ClassCastException` → 500。
 */
@Data
public class AdminUserUpdateDTO {
    /** 对应 user.nickname */
    private String name;
    private String email;
}
