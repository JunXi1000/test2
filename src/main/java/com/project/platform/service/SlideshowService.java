package com.project.platform.service;

import com.project.platform.entity.Slideshow;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 轮播图
 */
public interface SlideshowService {

    PageVO<Slideshow> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    Slideshow selectById(Integer id);

    List<Slideshow> list();

    void insert(Slideshow entity);

    void updateById(Slideshow entity);

    void removeByIds(List<Integer> id);
}
