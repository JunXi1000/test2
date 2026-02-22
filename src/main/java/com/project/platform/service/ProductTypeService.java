package com.project.platform.service;

import com.project.platform.entity.ProductType;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 商品分类
 */
public interface ProductTypeService {

    PageVO<ProductType> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    ProductType selectById(Integer id);

    List<ProductType> list();

    void insert(ProductType entity);

    void updateById(ProductType entity);

    void removeByIds(List<Integer> id);
}
