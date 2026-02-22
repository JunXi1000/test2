package com.project.platform.service.impl;

import com.project.platform.entity.Shop;
import com.project.platform.entity.ShopCollect;
import com.project.platform.entity.ShopCollect;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ShopCollectMapper;
import com.project.platform.mapper.ShopMapper;
import com.project.platform.service.ShopCollectService;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 店铺收藏
 */
@Service
public class ShopCollectServiceImpl implements ShopCollectService {
    @Resource
    private ShopCollectMapper shopCollectMapper;

    @Resource
    private ShopMapper shopMapper;

    @Override
    public PageVO<ShopCollect> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<ShopCollect> page = new PageVO();
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        List<ShopCollect> list = shopCollectMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(shopCollectMapper.queryCount(query));
        return page;
    }

    @Override
    public ShopCollect selectById(Integer id) {
        ShopCollect shopCollect = shopCollectMapper.selectById(id);
        return shopCollect;
    }

    @Override
    public List<ShopCollect> list() {
        return shopCollectMapper.list();
    }

    @Override
    public void insert(ShopCollect entity) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            throw new CustomException("普通用户才允许关注店铺");
        }
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        check(entity);
        Shop shop = shopMapper.selectById(entity.getShopId());
        shop.setFansCount(shop.getFansCount() + 1);
        shopMapper.updateById(shop);
        shopCollectMapper.insert(entity);
    }

    @Override
    public void updateById(ShopCollect entity) {
        check(entity);
        shopCollectMapper.updateById(entity);
    }

    private void check(ShopCollect entity) {
        ShopCollect shopCollect = shopCollectMapper.selectByProductIdAndUserId(entity.getShopId(), entity.getUserId());
        if (shopCollect != null && shopCollect.getId() != entity.getId()) {
            throw new CustomException("店铺已经关注过了");
        }

    }

    @Override
    public void removeByIds(List<Integer> ids) {
        ids.forEach(id -> {
            ShopCollect shopCollect = shopCollectMapper.selectById(id);
            Shop shop = shopMapper.selectById(shopCollect.getShopId());
            shop.setFansCount(shop.getFansCount() - 1);
            shopMapper.updateById(shop);
        });
        shopCollectMapper.removeByIds(ids);
    }
}
