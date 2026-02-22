package com.project.platform.service.impl;

import com.project.platform.entity.ProductBrowsingHistory;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ProductBrowsingHistoryMapper;
import com.project.platform.service.ProductBrowsingHistoryService;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 商品浏览历史
 */
@Service
public class ProductBrowsingHistoryServiceImpl implements ProductBrowsingHistoryService {
    @Resource
    private ProductBrowsingHistoryMapper productBrowsingHistoryMapper;

    @Override
    public PageVO<ProductBrowsingHistory> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<ProductBrowsingHistory> page = new PageVO();
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        List<ProductBrowsingHistory> list = productBrowsingHistoryMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(productBrowsingHistoryMapper.queryCount(query));
        return page;
    }

    @Override
    public ProductBrowsingHistory selectById(Integer id) {
        ProductBrowsingHistory productBrowsingHistory = productBrowsingHistoryMapper.selectById(id);
        return productBrowsingHistory;
    }

    @Override
    public List<ProductBrowsingHistory> list() {
        return productBrowsingHistoryMapper.list();
    }

    @Override
    public void insert(ProductBrowsingHistory entity) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            // 只记录普通用户的流量历史
            return;
        }
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        ProductBrowsingHistory productBrowsingHistory = productBrowsingHistoryMapper.selectByProductIdAndUserId(entity.getProductId(), entity.getUserId());
        //先删除，再添加，一个商品只能记录一次
        if (productBrowsingHistory != null) {
            List<Integer> ids = new ArrayList<>();
            ids.add(productBrowsingHistory.getId());
            removeByIds(ids);
        }
        check(entity);
        productBrowsingHistoryMapper.insert(entity);
    }

    @Override
    public void updateById(ProductBrowsingHistory entity) {
        check(entity);
        productBrowsingHistoryMapper.updateById(entity);
    }

    private void check(ProductBrowsingHistory entity) {

    }

    @Override
    public void removeByIds(List<Integer> ids) {
        productBrowsingHistoryMapper.removeByIds(ids);
    }
}

