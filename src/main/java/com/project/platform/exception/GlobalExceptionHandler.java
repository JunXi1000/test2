package com.project.platform.exception;

import com.project.platform.vo.ResponseVO;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;


/**
 * 全局异常拦截
 */
@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(CustomException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleCustomException(CustomException e) {
        return new ResponseEntity<>(
                ResponseVO.fail(e.getHttpStatus().value(), e.getMessage()),
                e.getHttpStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleMethodArgumentNotValid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getDefaultMessage() != null ? err.getDefaultMessage() : err.getField() + " 不合法")
                .findFirst()
                .orElse("参数校验失败");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseVO.fail(HttpStatus.BAD_REQUEST.value(), msg));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleConstraintViolation(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .findFirst()
                .orElse("参数校验失败");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseVO.fail(HttpStatus.BAD_REQUEST.value(), msg));
    }

    /**
     * 上传文件超过 spring.servlet.multipart 上限时返回 413, 而非落入通用 500
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ResponseVO.fail(HttpStatus.PAYLOAD_TOO_LARGE.value(), "上传文件过大, 最大 10MB"));
    }

    // ─────────────── 以下 5 个此前**没有**处理器,会落入通用 500 ───────────────
    // 客户端错误被报成 500 会让前端与运维都误判(500 意味着服务端故障),
    // 且掩盖真实语义。逐个补上,并对每一项都有对应测试。

    /**
     * 请求体畸形:不是合法 JSON、或字段类型无法反序列化 → 400
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleNotReadable(HttpMessageNotReadableException e) {
        log.debug("请求体无法解析:{}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseVO.fail(HttpStatus.BAD_REQUEST.value(), "请求体格式不正确"));
    }

    /**
     * 路径变量/查询参数类型不匹配(如 {@code GET /products/abc} 期望数字)→ 400
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseVO.fail(HttpStatus.BAD_REQUEST.value(),
                        "参数 " + e.getName() + " 类型不正确"));
    }

    /**
     * 缺少必填的查询参数 → 400
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleMissingParameter(MissingServletRequestParameterException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseVO.fail(HttpStatus.BAD_REQUEST.value(),
                        "缺少必填参数 " + e.getParameterName()));
    }

    /**
     * HTTP 方法不被支持(如对只接受 PUT 的端点发 DELETE)→ 405
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ResponseVO.fail(HttpStatus.METHOD_NOT_ALLOWED.value(),
                        "该接口不支持 " + e.getMethod() + " 方法"));
    }

    /**
     * 找不到任何处理器(路径既无 Controller 匹配、静态资源也不存在)→ 404,而非 500。
     *
     * <p><b>实际能走到这里的只有白名单路径</b>:Spring 把 {@code /**} 映射到静态资源处理器时
     * **不限方法**,方法检查发生在 handler 内部,因此 {@code getHandler()} 对任何路径都会成功 ——
     * 于是拦截器总有得跑。非白名单的未知路径会被 {@code LoginInterceptor} 的默认拒绝先挡掉
     * (匿名 401 / 已登录 403),根本到不了这里。白名单路径(如 {@code /search/**})则直接落到
     * 静态资源处理器,资源不存在时抛本异常。
     */
    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleNoResourceFound(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ResponseVO.fail(HttpStatus.NOT_FOUND.value(), "接口不存在"));
    }

    @ExceptionHandler(Exception.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleException(Exception e) {
        log.error("未处理异常", e);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ResponseVO.fail(HttpStatus.INTERNAL_SERVER_ERROR.value(), "服务器繁忙，请稍后再试"));
    }
}
