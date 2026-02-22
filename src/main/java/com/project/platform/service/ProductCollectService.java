package com.project.platform.service;

import com.project.platform.entity.ProductCollect;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 商品收藏
 */
public interface ProductCollectService {

    PageVO<ProductCollect> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    ProductCollect selectById(Integer id);

    List<ProductCollect> list();

    void insert(ProductCollect entity);

    void updateById(ProductCollect entity);

    void removeByIds(List<Integer> id);
}
