package com.project.platform.service;

import com.project.platform.dto.CreateOrderByShoppingCartDTO;
import com.project.platform.entity.ShoppingCart;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 购物车
 */
public interface ShoppingCartService {

    PageVO<ShoppingCart> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    ShoppingCart selectById(Integer id);

    List<ShoppingCart> list();

    void insert(ShoppingCart entity);

    void updateById(ShoppingCart entity);

    void removeByIds(List<Integer> id);
    void createOrder(CreateOrderByShoppingCartDTO createOrderByShoppingCartDTO);
}
