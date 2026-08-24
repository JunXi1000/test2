package com.project.platform.service.impl;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.Product;
import com.project.platform.entity.ProductBrowsingHistory;
import com.project.platform.entity.ProductCollect;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ProductBrowsingHistoryMapper;
import com.project.platform.mapper.ProductCollectMapper;
import com.project.platform.mapper.ProductMapper;
import com.project.platform.service.ProductService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.utils.PageParams;
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

    @Override
    public PageVO<Product> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<Product> page = new PageVO();
        // 公开接口(如 /products)可能无登录用户,需判空
        CurrentUserDTO currentUser = CurrentUserThreadLocal.getCurrentUser();
        if (currentUser != null && "SHOP".equals(currentUser.getType())) {
            query.put("shopId", currentUser.getId());
        }
        PageParams.Normalized p = PageParams.normalize(pageNum, pageSize);
        List<Product> list = productMapper.queryPage(p.offset(), p.pageSize(), query);
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
        if (quantity == null || quantity <= 0) {
            throw new CustomException("数量必须大于0");
        }
        // 原子回补库存
        int rows = productMapper.restoreStock(Id, quantity);
        if (rows == 0) {
            throw new CustomException("商品不存在");
        }
    }

    /**
     * 卖出
     */
    @Override
    public void out(Integer Id, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new CustomException("数量必须大于0");
        }
        // 原子扣减库存(乐观锁:stock>=qty 才扣),0 行即库存不足
        int rows = productMapper.deductStock(Id, quantity);
        if (rows == 0) {
            throw new CustomException("库存不足");
        }
    }

    @Override
    public List<Product> salesVolumeTop(int size) {
        int n = clampTopSize(size);
        return productMapper.salesVolumeTop(n);
    }

    @Override
    public List<Product> recommended(Integer size) {
        int n = clampTopSize(size == null ? 10 : size);
        List<Product> productList = list();
        // 公开接口可能无登录用户,无登录时跳过个性化权重
        CurrentUserDTO currentUser = CurrentUserThreadLocal.getCurrentUser();
        if (currentUser == null) {
            return productList.stream().limit(n).collect(Collectors.toList());
        }
        //浏览记录
        List<ValueNameVO> productBrowsingHistoryStatisticsList = productBrowsingHistoryMapper.statisticsProductTypeIdByUserId(currentUser.getId());
        //收藏
        List<ValueNameVO> productCollectStatisticsList = productCollectMapper.statisticsProductTypeIdByUserId(currentUser.getId());
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
                .limit(n)
                .collect(Collectors.toList());
    }

    private static int clampTopSize(int size) {
        if (size < 1) {
            return 10;
        }
        return Math.min(size, 100);
    }

}
