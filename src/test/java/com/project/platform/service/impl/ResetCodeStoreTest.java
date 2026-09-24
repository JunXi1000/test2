package com.project.platform.service.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link ResetCodeStore} 的纯单测 —— 每个测试用新的 store 实例,避免发送限流的 60s 间隔互相干扰。
 *
 * 覆盖 Phase 1c 补上的**校验失败次数上限**:此前校验侧可无限次猜测,6 位码在 5 分钟窗口内
 * 存在被暴力猜中的空间(发送侧的限流挡不住猜测)。
 */
class ResetCodeStoreTest {

    private static final String TYPE = "USER";
    private static final String TEL = "13800000001";

    private final ResetCodeStore store = new ResetCodeStore();

    @Test
    @DisplayName("正确验证码通过,且一次性使用")
    void correctCodePassesOnce() {
        String code = store.send(TYPE, TEL);
        assertTrue(store.verify(TYPE, TEL, code));
        assertFalse(store.verify(TYPE, TEL, code), "验证码应一次性使用,成功后即销毁");
    }

    @Test
    @DisplayName("未达失败上限时,正确码仍可用")
    void correctCodeStillWorksBelowLimit() {
        String code = store.send(TYPE, TEL);
        String wrong = wrongCodeFor(code);

        for (int i = 0; i < 4; i++) {
            assertFalse(store.verify(TYPE, TEL, wrong), "第 " + (i + 1) + " 次错误码应被拒绝");
        }
        assertTrue(store.verify(TYPE, TEL, code), "失败 4 次未达上限,正确码应仍然通过");
    }

    @Test
    @DisplayName("失败达 5 次即销毁:此后再用正确码也被拒(必须重新发送)")
    void fifthFailureDestroysCode() {
        String code = store.send(TYPE, TEL);
        String wrong = wrongCodeFor(code);

        for (int i = 0; i < 5; i++) {
            assertFalse(store.verify(TYPE, TEL, wrong));
        }
        assertFalse(store.verify(TYPE, TEL, code),
                "达到失败上限后验证码应已销毁,正确码也不可用 —— 这正是防暴力猜测的关键");
    }

    @Test
    @DisplayName("失败计数按 (type, tel) 隔离:换手机号从零计数")
    void failureCountsArePerKey() {
        String first = store.send(TYPE, TEL);
        String wrong = wrongCodeFor(first);
        for (int i = 0; i < 4; i++) {
            assertFalse(store.verify(TYPE, TEL, wrong));
        }
        // 注意:发送侧 60s 限流使同一号码无法立刻重发,故此处用另一个号码验证计数是按 key 隔离的。
        // 「重发清零计数」这条无法在单测里覆盖(不需要 sleep 60s),send() 里的 remove 属代码卫生。
        String otherTel = "13800000002";
        String code = store.send(TYPE, otherTel);
        for (int i = 0; i < 4; i++) {
            assertFalse(store.verify(TYPE, otherTel, wrongCodeFor(code)));
        }
        assertTrue(store.verify(TYPE, otherTel, code), "别的号码上的失败次数不应影响这个号码");
    }

    @Test
    @DisplayName("空验证码直接拒绝,不计入 store")
    void blankCodeRejected() {
        store.send(TYPE, TEL);
        assertFalse(store.verify(TYPE, TEL, null));
        assertFalse(store.verify(TYPE, TEL, ""));
    }

    @Test
    @DisplayName("未发送过的手机号一律拒绝(不会因为查不到就放行)")
    void neverSentTelRejected() {
        assertFalse(store.verify(TYPE, "13900000000", "123456"));
    }

    /** 构造一个必然不等于真实验证码的 6 位串 */
    private String wrongCodeFor(String code) {
        return "000000".equals(code) ? "111111" : "000000";
    }
}
