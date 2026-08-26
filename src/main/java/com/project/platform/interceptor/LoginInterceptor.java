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

import java.util.Set;

@Component
@Slf4j
public class LoginInterceptor implements HandlerInterceptor {

    /**
     * 公开下载的图片扩展名(与上传白名单中的图片部分一致)。
     * 仅这些允许免登录 GET,避免通过上传托管文档/压缩包等任意文件公开分发。
     * 不含 svg(上传白名单本来也没有),防止同源脚本执行面。
     */
    private static final Set<String> PUBLIC_IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "gif", "webp", "bmp");

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        long startTime = System.currentTimeMillis();
        request.setAttribute("requestStartTime", startTime);
        // OPTIONS请求不做校验,
        // 前后端分离的架构, 前端会发一个OPTIONS请求先做预检, 对预检请求不做校验
        if (request.getMethod().toUpperCase().equals("OPTIONS")) {
            return true;
        }
        // /file/** 仅「图片」GET 免登录(商品图/头像/logo 由 <img src> 直连, 无法携带 token);
        // 文档/压缩包等其他扩展名与上传 POST 一样需登录校验, 避免公开托管任意文件
        if (request.getRequestURI().startsWith("/file") && "GET".equalsIgnoreCase(request.getMethod())
                && isPublicImage(request.getRequestURI())) {
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
            // 与下方无效 token 一致,抛 CustomException 走全局异常处理,返回统一 JSON 错误体
            // (而非裸 401 空 body),保证前端错误格式一致。
            throw new CustomException(HttpStatus.UNAUTHORIZED, "未登录或登录已过期");
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

    private boolean isPublicImage(String uri) {
        String name = uri.substring(uri.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return false;
        }
        return PUBLIC_IMAGE_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase());
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
