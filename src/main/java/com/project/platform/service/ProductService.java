package com.project.platform.service;

import com.project.platform.entity.Product;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 商品信息
 */
public interface ProductService {

    PageVO<Product> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    Product selectById(Integer id);

    List<Product> list();

    void insert(Product entity);

    void updateById(Product entity);

    void removeByIds(List<Integer> id);

    void in(Integer Id,Integer quantity);

    void out(Integer Id,Integer quantity);

    List<Product> salesVolumeTop(int size);

    /** 单店销量榜(公开店铺页 featuredProducts);size 收敛到 1~100 */
    List<Product> salesVolumeTopByShopId(Integer shopId, int size);

    List<Product> recommended(Integer size);


}
