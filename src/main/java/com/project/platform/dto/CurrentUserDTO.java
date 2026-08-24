package com.project.platform.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

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
     * 余额(仅作快照展示,实际余额一律实时读 DB)
     */
    private BigDecimal balance;
}
