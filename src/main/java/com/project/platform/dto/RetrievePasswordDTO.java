package com.project.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class RetrievePasswordDTO {
    @NotBlank(message = "用户类型不能为空")
    @Pattern(regexp = "ADMIN|USER|SHOP", message = "用户类型必须为 ADMIN、USER 或 SHOP")
    private String type;
    @NotBlank(message = "手机号不能为空")
    private String tel;
    @NotBlank(message = "验证码不能为空")
    private String code;
    @NotBlank(message = "新密码不能为空")
    private String password;
}
