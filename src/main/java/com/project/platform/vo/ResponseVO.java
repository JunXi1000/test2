package com.project.platform.vo;

public class ResponseVO<T> {
    private int code;
    private String msg;
    private T data;

    public ResponseVO(int code, String msg, T data) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }

    public static ResponseVO ok() {
        return new ResponseVO(200, "操作成功", null);
    }

    public static ResponseVO ok(Object data) {
        return new ResponseVO(200, "操作成功", data);
    }

    /**
     * 失败响应。
     *
     * <p><b>过渡期双写</b>:具体原因**同时**写进 {@code msg} 与 {@code data}。
     *
     * <p>此前 {@code msg} 恒为字面量 {@code "操作失败"},真实原因只放在 {@code data} 里,
     * 导致契约层面 {@code msg} 形同废弃 —— 前端 {@code http.ts} 的拦截器就是靠从 {@code data}
     * 取原因折进 {@code e.message} 才拿到有用信息的。现在两处都带原因,对前端是**纯增量**:
     * 继续读 {@code data} 完全有效。待前端不再依赖 {@code data} 携带原因后,再收敛为
     * 「{@code msg} 放原因、{@code data} 只放业务数据」。
     *
     * @param code    业务状态码(与 HTTP 状态码一致)
     * @param message 给用户看的原因文案 —— 由调用方提供,不再固定
     */
    public static ResponseVO fail(int code, String message) {
        return new ResponseVO(code, message, message);
    }


    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMsg() {
        return msg;
    }

    public void setMsg(String msg) {
        this.msg = msg;
    }

    public Object getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
