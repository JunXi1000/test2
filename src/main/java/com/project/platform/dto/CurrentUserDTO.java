package com.project.platform.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CurrentUserDTO {
    @NotNull(message = "用户 id 不能为空")
    private Integer id;
    private String type;
    private String username;
    private String nickname;
    private String avatarUrl;
    private String tel;
    private String email;
    /**
     * 余额
     */
    private Float balance;
}
