package com.project.platform.service;

import com.project.platform.entity.Advertising;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 广告位
 */
public interface AdvertisingService {

    PageVO<Advertising> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    Advertising selectById(Integer id);

    List<Advertising> list();

    void insert(Advertising entity);

    void updateById(Advertising entity);

    void removeByIds(List<Integer> id);
}
