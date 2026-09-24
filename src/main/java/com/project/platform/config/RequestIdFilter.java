package com.project.platform.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 为每个请求分配一个 **requestId**,放进 MDC 并回写响应头,使日志可按请求串联。
 *
 * <p><b>为什么用 Filter 而不是 {@code LoginInterceptor}</b>:拦截器只对
 * {@code SpringMvcConfig} 白名单之外的路径生效 —— `/common/login`、`/products/**`、`/search/**`
 * 等公开路径根本不经过它,那些请求就不会有 requestId。Filter 在 servlet 层,覆盖全部请求。
 *
 * <p><b>MDC 是 ThreadLocal,必须在 finally 清除</b>:Tomcat 复用线程,不清会把上一个请求的
 * requestId 带进下一个请求的日志(表现为「日志串号」)。{@code RequestIdTest} 就断言了这一点。
 *
 * <p>id 取 UUID 的前 8 个十六进制字符(≈4×10⁹ 取值):足够在同一时间窗内区分并发请求,
 * 又比完整 UUID 短得多、日志里好读。**上游若已带 {@code X-Request-Id} 则沿用**,
 * 这样网关/前端发起的链路能接上。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    /** 响应头名,同时也是从上游沿用的请求头名 */
    public static final String HEADER = "X-Request-Id";

    /** MDC 键名,与 logback 的 {@code %X{requestId}} 对应 */
    public static final String MDC_KEY = "requestId";

    private static final int MAX_INCOMING_LENGTH = 64;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String requestId = request.getHeader(HEADER);
        if (requestId == null || requestId.isBlank() || requestId.length() > MAX_INCOMING_LENGTH) {
            requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        }
        MDC.put(MDC_KEY, requestId);
        response.setHeader(HEADER, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            // 必须清除:线程会被复用,残留会让后续请求的日志带上别人的 requestId
            MDC.remove(MDC_KEY);
        }
    }
}
