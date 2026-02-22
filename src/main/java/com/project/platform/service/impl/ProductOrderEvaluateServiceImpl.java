package com.project.platform.service.impl;

import com.project.platform.entity.ProductOrder;
import com.project.platform.entity.ProductOrderEvaluate;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ProductOrderEvaluateMapper;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.service.ProductOrderEvaluateService;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 订单评价
 */
@Service
public class ProductOrderEvaluateServiceImpl implements ProductOrderEvaluateService {
    @Resource
    private ProductOrderEvaluateMapper productOrderEvaluateMapper;

    @Resource
    private ProductOrderMapper productOrderMapper;

    @Override
    public PageVO<ProductOrderEvaluate> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<ProductOrderEvaluate> page = new PageVO();
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        List<ProductOrderEvaluate> list = productOrderEvaluateMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(productOrderEvaluateMapper.queryCount(query));
        return page;
    }

    @Override
    public ProductOrderEvaluate selectById(Integer id) {
        ProductOrderEvaluate productOrderEvaluate = productOrderEvaluateMapper.selectById(id);
        return productOrderEvaluate;
    }

    @Override
    public List<ProductOrderEvaluate> list() {
        return productOrderEvaluateMapper.list();
    }

    @Override
    public void insert(ProductOrderEvaluate entity) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            throw new CustomException("普通用户才能评价");
        }
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        check(entity);
        productOrderEvaluateMapper.insert(entity);
        ProductOrder productOrder = productOrderMapper.selectById(entity.getProductOrderId());
        productOrder.setOrderEvaluateId(entity.getId());
        productOrderMapper.updateById(productOrder);
    }

    @Override
    public void updateById(ProductOrderEvaluate entity) {
        check(entity);
        productOrderEvaluateMapper.updateById(entity);
    }

    private void check(ProductOrderEvaluate entity) {

    }

    @Override
    public void removeByIds(List<Integer> ids) {
        productOrderEvaluateMapper.removeByIds(ids);
    }
}

