package com.project.platform.exception;

import com.project.platform.vo.ResponseVO;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MaxUploadSizeExceededException;


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

    @ExceptionHandler(Exception.class)
    @ResponseBody
    public ResponseEntity<ResponseVO<Object>> handleException(Exception e) {
        log.error("未处理异常", e);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ResponseVO.fail(HttpStatus.INTERNAL_SERVER_ERROR.value(), "服务器繁忙，请稍后再试"));
    }
}
