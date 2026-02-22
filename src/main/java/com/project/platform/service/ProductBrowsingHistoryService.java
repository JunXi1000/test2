package com.project.platform.service;

import com.project.platform.entity.ProductBrowsingHistory;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 商品浏览历史
 */
public interface ProductBrowsingHistoryService {

    PageVO<ProductBrowsingHistory> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    ProductBrowsingHistory selectById(Integer id);

    List<ProductBrowsingHistory> list();

    void insert(ProductBrowsingHistory entity);

    void updateById(ProductBrowsingHistory entity);

    void removeByIds(List<Integer> id);
}
