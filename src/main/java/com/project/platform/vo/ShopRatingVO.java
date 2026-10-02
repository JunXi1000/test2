package com.project.platform.vo;

import lombok.Data;

/**
 * 店铺评价聚合:平均分、评价条数、好评率。
 *
 * <p>评价表 {@code product_order_evaluate} 只挂 product_id,没有 shop_id,
 * 所以店铺维度的评价统计必须经 {@code product_order_evaluate → product → shop_id} 关联得到。
 *
 * <p>三个字段可能同时为 0(店铺无评价),调用方需自行处理除零。
 */
@Data
public class ShopRatingVO {

    /** 平均评分,无评价时为 null(而不是 0 —— 0 分会被误读成"差评") */
    private Double avgRating;

    /** 评价条数 */
    private int totalReviews;

    /** 好评率(4 星及以上占比,0~100 的整数),无评价时为 0 */
    private int satisfactionRate;
}
