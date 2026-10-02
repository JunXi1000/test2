package com.project.platform.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 搜索价格区间的分面计数。
 *
 * <p>对应前端 {@code facets.priceRanges} 的元素:
 * {@code { label: string; min: number; max: number | null; count: number }}。
 *
 * <p>{@code min} / {@code max} / {@code label} 描述区间本身(服务层从 SQL 返回的
 * bucket 序号映射而来),{@code count} 是在**当前搜索条件下**落在该区间的商品数。
 */
@Data
public class PriceRangeCountVO {

    /** 展示标签,例如 "$50 - $200" */
    private String label;

    /** 区间下界(闭) */
    private BigDecimal min;

    /** 区间上界(开);null 表示无上界 */
    private BigDecimal max;

    /** 命中数量 */
    private int count;
}
