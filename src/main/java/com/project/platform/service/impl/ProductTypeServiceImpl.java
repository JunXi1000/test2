package com.project.platform.service.impl;

import com.project.platform.entity.ProductType;
import com.project.platform.mapper.ProductTypeMapper;
import com.project.platform.service.ProductTypeService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 商品分类
 */
@Service
public class ProductTypeServiceImpl  implements ProductTypeService {
    @Resource
    private ProductTypeMapper productTypeMapper;
    
    @Override
    public PageVO<ProductType> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<ProductType> page = new PageVO();
        List<ProductType> list = productTypeMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(productTypeMapper.queryCount(query));
        return page;
    }

    @Override
    public ProductType selectById(Integer id) {
        ProductType productType = productTypeMapper.selectById(id);
        return productType;
    }

    @Override
    public List<ProductType> list() {
        return productTypeMapper.list();
    }
    @Override
    public void insert(ProductType entity) {
        check(entity);
        productTypeMapper.insert(entity);
    }
    @Override
    public void updateById(ProductType entity) {
        check(entity);
        productTypeMapper.updateById(entity);
    }
    private void check(ProductType entity) {

    }
    @Override
    public void removeByIds(List<Integer> ids) {
        productTypeMapper.removeByIds(ids);
    }
}

