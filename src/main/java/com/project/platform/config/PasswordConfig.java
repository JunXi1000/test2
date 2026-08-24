package com.project.platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 密码哈希编码器
 * <p>
 * 全项目唯一 PasswordEncoder(BCrypt,strength=10)。
 * 仅使用 spring-security-crypto 的加密组件,不引入 Spring Security 过滤器链,
 * 与既有 LoginInterceptor + JWT 方案互不干扰。
 */
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }
}
