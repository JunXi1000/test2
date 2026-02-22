package com.project.platform.service.impl;

import com.project.platform.entity.ProductCollect;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ProductCollectMapper;
import com.project.platform.service.ProductCollectService;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 商品收藏
 */
@Service
public class ProductCollectServiceImpl implements ProductCollectService {
    @Resource
    private ProductCollectMapper productCollectMapper;

    @Override
    public PageVO<ProductCollect> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<ProductCollect> page = new PageVO();
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        List<ProductCollect> list = productCollectMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(productCollectMapper.queryCount(query));
        return page;
    }

    @Override
    public ProductCollect selectById(Integer id) {
        ProductCollect productCollect = productCollectMapper.selectById(id);
        return productCollect;
    }

    @Override
    public List<ProductCollect> list() {
        return productCollectMapper.list();
    }

    @Override
    public void insert(ProductCollect entity) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            throw new CustomException("普通用户才允许收藏商品");
        }
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        check(entity);
        productCollectMapper.insert(entity);
    }

    @Override
    public void updateById(ProductCollect entity) {
        check(entity);
        productCollectMapper.updateById(entity);
    }

    private void check(ProductCollect entity) {
        ProductCollect productCollect = productCollectMapper.selectByProductIdAndUserId(entity.getProductId(), entity.getUserId());
        if (productCollect != null && productCollect.getId() != entity.getId()) {
            throw new CustomException("商品已经收藏过了");
        }

    }

    @Override
    public void removeByIds(List<Integer> ids) {
        productCollectMapper.removeByIds(ids);
    }
}
