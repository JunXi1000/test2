package com.project.platform.config;

import com.project.platform.interceptor.LoginInterceptor;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;


@Configuration
public class SpringMvcConfig implements WebMvcConfigurer {

    @Resource
    LoginInterceptor loginInterceptor;

    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loginInterceptor)
                .addPathPatterns("/**")
                //允许直接访问的接口
                .excludePathPatterns(
                        "/common/login",
                        "/common/register",
                        "/common/sendResetCode",
                        "/common/retrievePassword",
                        // 注意: /file/** 不在白名单 —— GET 下载由 LoginInterceptor 放行, 上传 POST 需登录
                        // Public storefront — no auth required
                        "/products/**",
                        "/search/**",
                        "/merchants/**",
                        "/checkout/summary",
                        "/checkout/promo",
                        // 注意: /payments/create 需要登录(创建订单),不能放白名单
                        // 错误转发路径必须放行 —— 否则 LoginInterceptor 的「默认拒绝」会把
                        // 错误渲染本身变成 403,客户端拿不到真正的 4xx/5xx 语义
                        "/error"
                );
    }
}
