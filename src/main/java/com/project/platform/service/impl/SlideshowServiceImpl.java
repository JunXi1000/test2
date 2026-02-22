package com.project.platform.service.impl;

import com.project.platform.entity.Slideshow;
import com.project.platform.mapper.SlideshowMapper;
import com.project.platform.service.SlideshowService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 轮播图
 */
@Service
public class SlideshowServiceImpl  implements SlideshowService {
    @Resource
    private SlideshowMapper slideshowMapper;
    
    @Override
    public PageVO<Slideshow> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<Slideshow> page = new PageVO();
        List<Slideshow> list = slideshowMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(slideshowMapper.queryCount(query));
        return page;
    }

    @Override
    public Slideshow selectById(Integer id) {
        Slideshow slideshow = slideshowMapper.selectById(id);
        return slideshow;
    }

    @Override
    public List<Slideshow> list() {
        return slideshowMapper.list();
    }
    @Override
    public void insert(Slideshow entity) {
        check(entity);
        entity.setSort(0);
        slideshowMapper.insert(entity);
    }
    @Override
    public void updateById(Slideshow entity) {
        check(entity);
        slideshowMapper.updateById(entity);
    }
    private void check(Slideshow entity) {

    }
    @Override
    public void removeByIds(List<Integer> ids) {
        slideshowMapper.removeByIds(ids);
    }
}

