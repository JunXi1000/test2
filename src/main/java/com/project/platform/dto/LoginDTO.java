package com.project.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class LoginDTO {
    @NotBlank(message = "用户名不能为空")
    private String username;
    @NotBlank(message = "密码不能为空")
    private String password;
    @NotBlank(message = "用户类型不能为空")
    @Pattern(regexp = "ADMIN|USER|SHOP", message = "用户类型必须为 ADMIN、USER 或 SHOP")
    private String type;
}
