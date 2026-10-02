package com.project.platform.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 「评分 ≥ N 星」的分面计数。
 *
 * <p>对应前端 {@code facets.ratings} 的元素 {@code { value: number; count: number }}。
 * 注意这是**累计**口径(value=4 表示 4 星及以上),不是「恰好 4 星」。
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class RatingCountVO {

    /** 评分下限(含):4 / 3 / 2 */
    private int value;

    /** 命中商品数 */
    private int count;
}
