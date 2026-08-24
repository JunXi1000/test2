package com.project.platform.service.impl;

import com.project.platform.exception.CustomException;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 找回密码验证码存储(演示实现:内存 Map + 5 分钟 TTL)。
 * 接入真实短信/邮件服务时,替换为 Redis 存储并改为下发而非返回。
 * 发送限流:同一 (type, tel) 最小间隔 60s、单日上限 10 次(进程内统计,重启清零)。
 */
@Component
public class ResetCodeStore {

    private static final Duration TTL = Duration.ofMinutes(5);
    private static final int CODE_LENGTH = 6;
    private static final Duration MIN_SEND_INTERVAL = Duration.ofSeconds(60);
    private static final int DAILY_SEND_LIMIT = 10;

    private final Map<String, CodeEntry> store = new ConcurrentHashMap<>();
    private final Map<String, SendState> sendStates = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private record CodeEntry(String code, Instant expiresAt) {
        boolean expired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    /** 发送限流状态:最近发送时间 + 当日累计次数(跨天自动重置) */
    private record SendState(Instant lastSentAt, LocalDate day, int count) {
    }

    private String key(String type, String tel) {
        return type + ":" + tel;
    }

    /**
     * 生成并保存 6 位验证码。
     *
     * @return 验证码(演示环境默认直接返回,便于页面展示;生产应关闭返回并改为下发)
     */
    public String send(String type, String tel) {
        checkRateLimit(type, tel);
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

    /**
     * 发送限流:同一 (type, tel) 最小间隔 60s,单日上限 10 次;超限抛异常拒绝发送。
     * 用 compute 原子地完成「读上次状态 → 校验 → 更新」,并发下恰好一个线程通过,
     * 后续线程必然观察到更新后的 lastSentAt,杜绝同一窗口内并发绕过;回调抛异常时映射保持不变。
     */
    private void checkRateLimit(String type, String tel) {
        String k = key(type, tel);
        Instant now = Instant.now();
        LocalDate today = LocalDate.now();
        sendStates.compute(k, (key, prev) -> {
            int count = 0;
            if (prev != null && today.equals(prev.day())) {
                count = prev.count();
                if (now.isBefore(prev.lastSentAt().plus(MIN_SEND_INTERVAL))) {
                    throw new CustomException("验证码发送过于频繁,请稍后再试");
                }
                if (count >= DAILY_SEND_LIMIT) {
                    throw new CustomException("今日验证码发送次数已达上限");
                }
            }
            return new SendState(now, today, count + 1);
        });
    }
}
