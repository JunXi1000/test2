package com.project.platform.dto;

import lombok.Data;

/**
 * 商品搜索(POST /search)的入参。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应。**不加新校验**,原有的边界收敛
 * (page &lt; 1 → 1、limit &lt; 1 → 20)仍留在控制器里。
 *
 * <p>用包装类型 {@code Integer} 而非 {@code int}:既有实现用 {@code getIntValue} 读,
 * 缺失时得 0,再由「&lt; 1 → 1」收敛为 1;换成 Integer 后缺失为 null,控制器按
 * 「null 或 &lt; 1 → 1」收敛,结果相同。
 */
@Data
public class SearchRequestDTO {
    private String q;
    private String category;
    private Integer page;
    private Integer limit;
    /** 仅识别 price-asc / price-desc,其余按默认排序 */
    private String sort;
}
