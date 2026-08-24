package com.project.platform.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 管理员信息表
 */
@Data
public class Admin {
    private Integer id;
    private String username;
    /** 仅序列化时忽略,setter 保留以便反序列化与 MyBatis 回填 */
    @JsonIgnore
    private String password;
    private String nickname;
    private String avatarUrl;
    private String tel;
    private String email;
    private String status;
    private LocalDateTime createTime;
}
