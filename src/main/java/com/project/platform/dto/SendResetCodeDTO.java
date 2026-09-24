package com.project.platform.dto;

import lombok.Data;

/**
 * 发送找回密码验证码(POST /common/sendResetCode)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。**不加新校验** —— 原有的
 * 「用户类型与手机号不能为空」(409)仍留在控制器里,状态码不变。
 */
@Data
public class SendResetCodeDTO {
    /** 用户类型:ADMIN / USER / SHOP */
    private String type;
    private String tel;
}
