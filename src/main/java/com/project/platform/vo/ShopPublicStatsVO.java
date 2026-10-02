package com.project.platform.vo;

import lombok.Data;

/**
 * 公开店铺页的统计块。
 *
 * <p>对应前端 {@code MerchantPublicProfile.stats} 的六个字段,一个不多一个不少。
 * 这些数字全部由 SQL 聚合得出(见 {@code AnalyticsMapper}),不再有硬编码。
 */
@Data
public class ShopPublicStatsVO {

    /** 平均评分,保留一位小数;无评价时为 0.0 */
    private double rating;

    /** 评价条数 */
    private int totalReviews;

    /** 在售商品数 */
    private int totalProducts;

    /** 累计卖出件数(product.sales_volume 之和) */
    private long totalSales;

    /** 好评率(4 星及以上占比,0~100) */
    private int satisfactionRate;

    /** 粉丝数(shop.fans_count) */
    private int followers;
}
