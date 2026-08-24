package com.project.platform.service.impl;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 找回密码验证码存储(演示实现:内存 Map + 5 分钟 TTL)。
 * 接入真实短信/邮件服务时,替换为 Redis 存储并改为下发而非返回。
 */
@Component
public class ResetCodeStore {

    private static final Duration TTL = Duration.ofMinutes(5);
    private static final int CODE_LENGTH = 6;

    private final Map<String, CodeEntry> store = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private record CodeEntry(String code, Instant expiresAt) {
        boolean expired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    private String key(String type, String tel) {
        return type + ":" + tel;
    }

    /**
     * 生成并保存 6 位验证码。
     *
     * @return 验证码(演示环境直接返回,便于页面展示)
     */
    public String send(String type, String tel) {
        String code = String.format("%0" + CODE_LENGTH + "d", random.nextInt(1_000_000));
        store.put(key(type, tel), new CodeEntry(code, Instant.now().plus(TTL)));
        return code;
    }

    /**
     * 校验验证码:存在、未过期且与 (type, tel) 匹配则通过并销毁,否则返回 false。
     */
    public boolean verify(String type, String tel, String code) {
        if (code == null || code.isEmpty()) {
            return false;
        }
        CodeEntry entry = store.get(key(type, tel));
        if (entry == null || entry.expired() || !entry.code().equals(code)) {
            return false;
        }
        store.remove(key(type, tel));
        return true;
    }
}
