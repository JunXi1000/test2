package com.project.platform.service;

import com.project.platform.dto.RetrievePasswordDTO;
import com.project.platform.entity.Shop;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 店铺
 */
public interface ShopService extends CommonService {

    PageVO<Shop> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    Shop selectById(Integer id);

    List<Shop> list();

    void insert(Shop entity);

    void updateById(Shop entity);

    void removeByIds(List<Integer> id);

    void retrievePassword(RetrievePasswordDTO retrievePasswordDTO);
}
