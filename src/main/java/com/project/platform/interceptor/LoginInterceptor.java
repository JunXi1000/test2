package com.project.platform.interceptor;

import com.alibaba.fastjson2.JSON;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.exception.CustomException;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.utils.JwtUtils;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

@Component
@Slf4j
public class LoginInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        long startTime = System.currentTimeMillis();
        request.setAttribute("requestStartTime", startTime);
        // OPTIONS请求不做校验,
        // 前后端分离的架构, 前端会发一个OPTIONS请求先做预检, 对预检请求不做校验
        if (request.getMethod().toUpperCase().equals("OPTIONS")) {
            return true;
        }
        // /file/** 的 GET 下载公开(商品图片/附件由 <img src> 直连, 无法携带 token),
        // 其余方法(上传 POST 等)走下方登录校验
        if (request.getRequestURI().startsWith("/file") && "GET".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURL().toString();
        log.debug("接口登录拦截 path={}", path);
        // Support both "token" header (legacy) and "Authorization: Bearer <token>" (frontend)
        String token = request.getHeader("token");
        if (token == null || token.isEmpty()) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }
        }
        log.debug("登录校验 token 是否为空={}", token == null || token.isEmpty());
        if (token == null || token.isEmpty()) {
            log.debug("token 为空，请求被拦截");
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            return false;
        }
        Claims claims = JwtUtils.verifyJwt(token);
        //获取用户ID
        if (claims == null) {
            log.warn("token无效，请求被拦截");
            throw new CustomException(HttpStatus.UNAUTHORIZED,"token无效，请求被拦截");
        } else {
            CurrentUserDTO currentUserDTO = JSON.parseObject(claims.get("currentUser").toString(), CurrentUserDTO.class);
            // 基于路径的角色校验: /admin/** 仅管理员, /merchant/** 仅商家
            if (!checkRole(request.getRequestURI(), currentUserDTO)) {
                throw new CustomException(HttpStatus.FORBIDDEN, "无权限访问该接口");
            }
            CurrentUserThreadLocal.set(currentUserDTO);
            return true;
        }
    }

    /**
     * 按路径前缀校验角色权限
     * 注意: /merchants/** (公开店铺页) 与 /merchant/** (商家后台) 前缀不同, 需区分
     */
    private boolean checkRole(String path, CurrentUserDTO currentUserDTO) {
        String type = currentUserDTO.getType();
        // 显式「路径前缀→角色」映射,收紧遗留 CRUD 接口的越权面
        if (path.startsWith("/admin")) {
            return "ADMIN".equals(type);
        }
        // /merchant/** 为商家后台; /merchants/** 为公开店铺页(已配置白名单,不经过此处)
        if (path.startsWith("/merchant/")) {
            return "SHOP".equals(type);
        }
        // /user/**、/productOrder/** 为后台/遗留 CRUD,前端不调用,收紧为仅管理员
        if (path.startsWith("/user")) {
            return "ADMIN".equals(type);
        }
        if (path.startsWith("/productOrder")) {
            return "ADMIN".equals(type);
        }
        // 其余接口(公开白名单外的)保持"任意登录用户可访问"
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {
        Object start = request.getAttribute("requestStartTime");
        if (start instanceof Long startTime) {
            log.debug("LoginInterceptor 耗时 {} ms", System.currentTimeMillis() - startTime);
        }
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        CurrentUserThreadLocal.clear();
    }
}
