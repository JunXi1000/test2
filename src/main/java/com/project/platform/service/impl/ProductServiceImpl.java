package com.project.platform.service.impl;

import com.project.platform.entity.Product;
import com.project.platform.entity.ProductBrowsingHistory;
import com.project.platform.entity.ProductCollect;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ProductBrowsingHistoryMapper;
import com.project.platform.mapper.ProductCollectMapper;
import com.project.platform.mapper.ProductMapper;
import com.project.platform.service.ProductService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ValueNameVO;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 商品信息
 */
@Service
public class ProductServiceImpl implements ProductService {
    @Resource
    private ProductMapper productMapper;

    @Resource
    private ProductBrowsingHistoryMapper productBrowsingHistoryMapper;
    @Resource
    private ProductCollectMapper productCollectMapper;
    ;

    @Override
    public PageVO<Product> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<Product> page = new PageVO();
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("SHOP")) {
            query.put("shopId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        List<Product> list = productMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(productMapper.queryCount(query));
        return page;
    }

    @Override
    public Product selectById(Integer id) {
        Product product = productMapper.selectById(id);
        return product;
    }

    @Override
    public List<Product> list() {
        return productMapper.list();
    }

    @Override
    public void insert(Product entity) {
        check(entity);
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("SHOP")) {
            throw new CustomException("当前用户不是商家，只有商家才允许添加商品");
        }
        entity.setShopId(CurrentUserThreadLocal.getCurrentUser().getId());
        entity.setSalesVolume(0);
        productMapper.insert(entity);
    }

    @Override
    public void updateById(Product entity) {
        check(entity);
        productMapper.updateById(entity);
    }

    private void check(Product entity) {

    }

    @Override
    public void removeByIds(List<Integer> ids) {
        productMapper.removeByIds(ids);
    }

    /**
     * 退货
     *
     * @param Id
     */
    @Override
    public void in(Integer Id, Integer quantity) {
        Product product = productMapper.selectById(Id);
        product.setStock(product.getStock() + quantity);
        product.setSalesVolume(product.getSalesVolume() - quantity);
        productMapper.updateById(product);
    }

    /**
     * 卖出
     */
    @Override
    public void out(Integer Id, Integer quantity) {
        Product product = productMapper.selectById(Id);
        if (product.getStock() < quantity) {
            throw new CustomException("库存不足");
        }
        product.setStock(product.getStock() - quantity);
        product.setSalesVolume(product.getSalesVolume() + quantity);
        productMapper.updateById(product);
    }

    @Override
    public List<Product> salesVolumeTop(int size) {
        return productMapper.salesVolumeTop(size);
    }

    @Override
    public List<Product> recommended(Integer size) {
        List<Product> productList = list();
        //浏览记录
        List<ValueNameVO> productBrowsingHistoryStatisticsList = productBrowsingHistoryMapper.statisticsProductTypeIdByUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        //收藏
        List<ValueNameVO> productCollectStatisticsList = productCollectMapper.statisticsProductTypeIdByUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        for (Product product : productList) {
            for (ValueNameVO item : productBrowsingHistoryStatisticsList) {
                if (item.getName().equals(product.getProductTypeId())) {
                    product.setWeight(product.getWeight() + 1);
                }
            }
            for (ValueNameVO item : productCollectStatisticsList) {
                if (item.getName().equals(product.getProductTypeId())) {
                    product.setWeight(product.getWeight() + 1);
                }
            }
        }
        //根据权重排序
        return productList.stream()
                .sorted(Comparator.comparing(Product::getWeight).reversed())
                .limit(size)
                .collect(Collectors.toList());
    }


}
