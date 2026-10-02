package com.project.platform.vo;

import lombok.Data;

import java.util.List;

/**
 * POST /search 的分面(facets)。
 *
 * <p>对应前端 {@code SearchResults.facets}:
 * {@code { categories: {name,count}[]; priceRanges: {label,min,max,count}[]; ratings: {value,count}[] }}。
 *
 * <p><b>口径约定</b>:三个维度都只应用「关键字」过滤,**不**应用当前已选的分类 ——
 * 否则用户一旦选了某个分类,其他分类的计数就全变成 0,分面就成了死路。
 * (标准的 faceted search:每个维度用「除自己以外的所有过滤」来计数。)
 */
@Data
public class SearchFacetsVO {

    /** 分类维度:分类名 + 命中数,按命中数倒序 */
    private List<CategoryCountVO> categories;

    /** 价格区间维度,只含命中最多的区间(count > 0) */
    private List<PriceRangeCountVO> priceRanges;

    /** 评分维度(4/3/2 星及以上),只含 count > 0 的档位 */
    private List<RatingCountVO> ratings;
}
