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
                        // 注意: /checkout/** 与 /payments/create 都**不在**白名单 —— 结算流程
                        // (摘要 / 优惠码 / 下单)整体需要登录。此前 /checkout/summary 与
                        // /checkout/promo 在白名单里,导致 LoginInterceptor 不执行、
                        // CurrentUserThreadLocal 恒空,券校验对**已登录用户也**报 400
                        // 「请先登录后再使用优惠码」—— 白名单是全有或全无,没有「可选鉴权」这一档。
                        // 两者的角色登记见 AuthzRules(`/checkout/**`)。
                        // 错误转发路径必须放行 —— 否则 LoginInterceptor 的「默认拒绝」会把
                        // 错误渲染本身变成 403,客户端拿不到真正的 4xx/5xx 语义
                        "/error"
                );
    }
}
