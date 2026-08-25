package com.project.platform.service;

import com.project.platform.dto.StorefrontCheckoutDTO;
import com.project.platform.entity.ProductOrder;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.StorefrontCheckoutResult;
import com.project.platform.vo.StorefrontOrderVO;

import java.util.List;
import java.util.Map;

/**
 * 商品订单
 */
public interface ProductOrderService {

    PageVO<ProductOrder> page(Map<String, Object> query, Integer pageNum, Integer pageSize);

    ProductOrder selectById(Integer id);

    List<ProductOrder> list();

    void insert(ProductOrder entity);

    void updateById(ProductOrder entity);

    void removeByIds(List<Integer> id);

    void pay(Integer id);

    void cancel(Integer id);

    void delivery(Integer id, String deliveryNo);

    void confirm(Integer id);

    /**
     * 前台结算下单(Phase 2):一次结算一个 order_no 分组 + 一张支付单,原子扣库存。
     * 返回分组号与待支付金额。
     */
    StorefrontCheckoutResult createStorefrontOrder(StorefrontCheckoutDTO dto);

    /**
     * 按订单分组号取消(Phase 2):回补库存 + 已付款退款 + 支付单推进,幂等。
     */
    void cancelByOrderNo(String orderNo);

    /**
     * 前台订单分组列表(Phase 2):按 order_no 聚合成订单,旧行各自成组,按 createTime 倒序。
     */
    List<StorefrontOrderVO> listStorefrontOrders(Integer pageNum, Integer pageSize);

    /**
     * 超时自动取消(Phase 2,无用户上下文):回补库存 + 支付单置已超时。
     */
    void cancelTimeoutOrder(String orderNo);
}
