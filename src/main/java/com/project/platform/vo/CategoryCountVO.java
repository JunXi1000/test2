package com.project.platform.vo;

import lombok.Data;

/**
 * 分类计数:分类名 + 该分类下的商品数。
 *
 * <p>供 {@code GET /products/category-counts}(键值对形态)与
 * {@code POST /search} 的 {@code facets.categories}(数组形态)共用同一份聚合结果。
 */
@Data
public class CategoryCountVO {

    /** 分类名(product_type.name) */
    private String name;

    /** 该分类下的商品数 */
    private int count;
}
