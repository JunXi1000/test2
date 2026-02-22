package com.project.platform.service;

import com.project.platform.entity.ShopCollect;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 店铺收藏
 */
public interface ShopCollectService {

    PageVO<ShopCollect> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    ShopCollect selectById(Integer id);

    List<ShopCollect> list();

    void insert(ShopCollect entity);

    void updateById(ShopCollect entity);

    void removeByIds(List<Integer> id);
}
