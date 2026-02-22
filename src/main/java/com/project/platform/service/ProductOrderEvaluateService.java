package com.project.platform.service;

import com.project.platform.entity.ProductOrderEvaluate;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 订单评价
 */
public interface ProductOrderEvaluateService {

    PageVO<ProductOrderEvaluate> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    ProductOrderEvaluate selectById(Integer id);

    List<ProductOrderEvaluate> list();

    void insert(ProductOrderEvaluate entity);

    void updateById(ProductOrderEvaluate entity);

    void removeByIds(List<Integer> id);
}
