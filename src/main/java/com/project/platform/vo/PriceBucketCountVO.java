package com.project.platform.vo;

import lombok.Data;

/**
 * 价格分桶的原始计数(服务层内部用,不直接出现在响应里)。
 *
 * <p>{@code bucket} 取值与 {@code AnalyticsMapper.xml} 里 {@code priceBuckets} 的
 * {@code CASE} 分支一一对应:
 * <ul>
 *   <li>{@code 0} → 0 ≤ price &lt; 50</li>
 *   <li>{@code 1} → 50 ≤ price &lt; 200</li>
 *   <li>{@code 2} → 200 ≤ price &lt; 500</li>
 *   <li>{@code 3} → 500 ≤ price &lt; 1000</li>
 *   <li>{@code 4} → price ≥ 1000</li>
 * </ul>
 * 展示用的 label / min / max 由服务层从 {@code bucket} 映射,不在 SQL 里拼字符串。
 */
@Data
public class PriceBucketCountVO {

    /** 区间序号,见类注释 */
    private int bucket;

    /** 命中数量 */
    private int count;
}
