package com.project.platform.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link RequestIdFilter} 的单测 —— 不起 Spring,毫秒级。
 *
 * <p>只测两件真正要紧的事:**请求期间 MDC 里有 requestId**(否则日志串不起来),
 * 以及**请求结束后它被清除**(Tomcat 复用线程,残留会让下一个请求的日志带上别人的 id)。
 * 其余是关于「沿用上游 id」与「过长 id 不采信」的边界。
 */
class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    @DisplayName("无上游 id 时自动生成,并回写响应头;请求期间 MDC 有值,结束后清除")
    void generatesAndClears() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/products");
        MockHttpServletResponse response = new MockHttpServletResponse();

        String[] seenInsideChain = new String[1];
        FilterChain chain = (req, res) -> {
            // 链内读取:此时 MDC 必须有值,且与响应头一致
            seenInsideChain[0] = MDC.get(RequestIdFilter.MDC_KEY);
            assertNotNull(seenInsideChain[0], "请求处理期间 MDC 必须有 requestId");
        };

        filter.doFilter(request, response, chain);

        String header = response.getHeader(RequestIdFilter.HEADER);
        assertNotNull(header, "响应头必须回写 requestId,便于排障时按 id 关联前后端");
        assertEquals(seenInsideChain[0], header, "MDC 里的值应与响应头一致");
        assertTrue(header.matches("[0-9a-f]{8}"), "自动生成的是 8 位十六进制,实际=" + header);

        assertNull(MDC.get(RequestIdFilter.MDC_KEY),
                "请求结束后必须清除 —— 线程会被复用,残留会造成日志串号");
    }

    @Test
    @DisplayName("上游带了 X-Request-Id 就沿用,不覆盖")
    void honorsIncomingId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/orders");
        request.addHeader(RequestIdFilter.HEADER, "upstream-abc123");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> assertEquals("upstream-abc123",
                MDC.get(RequestIdFilter.MDC_KEY)));

        assertEquals("upstream-abc123", response.getHeader(RequestIdFilter.HEADER));
        assertNull(MDC.get(RequestIdFilter.MDC_KEY));
    }

    @Test
    @DisplayName("过长的上游 id 不采信(避免被塞进超长值污染日志),改用自动生成")
    void rejectsOverlongIncomingId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/orders");
        request.addHeader(RequestIdFilter.HEADER, "x".repeat(200));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> { });

        String header = response.getHeader(RequestIdFilter.HEADER);
        assertNotEquals("x".repeat(200), header);
        assertTrue(header.matches("[0-9a-f]{8}"));
    }

    @Test
    @DisplayName("链路抛异常也要清除 MDC(finally 生效)")
    void clearsEvenWhenChainThrows() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/orders");
        MockHttpServletResponse response = new MockHttpServletResponse();

        try {
            filter.doFilter(request, response, (req, res) -> {
                throw new IllegalStateException("boom");
            });
        } catch (Exception ignored) {
            // 预期:异常向上传播,但这不影响 MDC 必须被清除
        }

        assertNull(MDC.get(RequestIdFilter.MDC_KEY), "异常路径同样不能残留");
    }
}
