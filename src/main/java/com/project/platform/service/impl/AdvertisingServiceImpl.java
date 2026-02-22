package com.project.platform.service.impl;

import com.project.platform.entity.Advertising;
import com.project.platform.mapper.AdvertisingMapper;
import com.project.platform.service.AdvertisingService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 广告位
 */
@Service
public class AdvertisingServiceImpl  implements AdvertisingService {
    @Resource
    private AdvertisingMapper advertisingMapper;
    
    @Override
    public PageVO<Advertising> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<Advertising> page = new PageVO();
        List<Advertising> list = advertisingMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(advertisingMapper.queryCount(query));
        return page;
    }

    @Override
    public Advertising selectById(Integer id) {
        Advertising advertising = advertisingMapper.selectById(id);
        return advertising;
    }

    @Override
    public List<Advertising> list() {
        return advertisingMapper.list();
    }
    @Override
    public void insert(Advertising entity) {
        check(entity);
        entity.setSort(0);
        advertisingMapper.insert(entity);
    }
    @Override
    public void updateById(Advertising entity) {
        check(entity);
        advertisingMapper.updateById(entity);
    }
    private void check(Advertising entity) {

    }
    @Override
    public void removeByIds(List<Integer> ids) {
        advertisingMapper.removeByIds(ids);
    }
}

