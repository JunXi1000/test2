package com.project.platform.service.impl;

import com.project.platform.entity.Product;
import com.project.platform.entity.ProductOrder;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.service.ProductOrderService;
import com.project.platform.service.ProductService;
import com.project.platform.service.UserService;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

/**
 * 商品订单
 */
@Service
public class ProductOrderServiceImpl implements ProductOrderService {
    @Resource
    private ProductOrderMapper productOrderMapper;

    @Resource
    private ProductService productService;

    @Resource
    private UserService userService;


    @Override
    public PageVO<ProductOrder> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<ProductOrder> page = new PageVO();
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("SHOP")) {
            query.put("shopId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        List<ProductOrder> list = productOrderMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(productOrderMapper.queryCount(query));
        return page;
    }

    @Override
    public ProductOrder selectById(Integer id) {
        ProductOrder productOrder = productOrderMapper.selectById(id);
        return productOrder;
    }

    @Override
    public List<ProductOrder> list() {
        return productOrderMapper.list();
    }

    @Override
    public void insert(ProductOrder entity) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            throw new CustomException("普通用户才允许下单");
        }
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        entity.setStatus("待支付");

        //商品出库
        productService.out(entity.getProductId(), entity.getQuantity());
        Product product = productService.selectById(entity.getProductId());
        entity.setShopId(product.getShopId());
        //设置订单金额，通过后端计算，保证安全性
        entity.setTotalMoney(product.getPrice() * entity.getQuantity());
        check(entity);
        productOrderMapper.insert(entity);
    }

    @Override
    public void updateById(ProductOrder entity) {
        check(entity);
        productOrderMapper.updateById(entity);
    }

    private void check(ProductOrder entity) {
        if (entity.getQuantity() == null || entity.getQuantity() <= 0) {
            throw new CustomException("数量必须大于0");
        }
    }

    @Override
    public void removeByIds(List<Integer> ids) {
        productOrderMapper.removeByIds(ids);
    }


    /**
     * 支付
     *
     * @param id
     */
    public void pay(Integer id) {
        ProductOrder productOrder = selectById(id);
        if (!productOrder.getStatus().equals("待支付")) {
            throw new CustomException("数据已过期，请先刷新页面");
        }
        //消费 TODO 退款
        userService.consumption(productOrder.getUserId(), productOrder.getTotalMoney());
        productOrder.setStatus("待发货");
        updateById(productOrder);
    }

    /**
     * 取消
     *
     * @param id
     */
    public void cancel(Integer id) {
        ProductOrder productOrder = selectById(id);
        if (!productOrder.getStatus().equals("待发货") && !productOrder.getStatus().equals("待支付")) {
            throw new CustomException("数据已过期，请先刷新页面");
        }
        //返回库存
        productService.in(productOrder.getProductId(), productOrder.getQuantity());
        //退款 只有已付款的才退款 TODO 退款
        if (productOrder.getStatus().equals("待发货")) {
            userService.topUp(productOrder.getUserId(), productOrder.getTotalMoney());
        }
        productOrder.setStatus("已取消");
        updateById(productOrder);
    }

    /**
     * 发货
     *
     * @param id
     * @param trackingNumber 发货单号
     */
    public void delivery(Integer id, String trackingNumber) {
        ProductOrder productOrder = selectById(id);
        if (!productOrder.getStatus().equals("待发货")) {
            throw new CustomException("数据已过期，请先刷新页面");
        }
        productOrder.setStatus("待收货");
        productOrder.setTrackingNumber(trackingNumber);
        updateById(productOrder);
    }

    /**
     * 确认收货
     *
     * @param id
     */
    public void confirm(Integer id) {
        ProductOrder productOrder = selectById(id);
        if (!productOrder.getStatus().equals("待收货")) {
            throw new CustomException("数据已过期，请先刷新页面");
        }
        productOrder.setStatus("已完成");
        updateById(productOrder);
    }


}
