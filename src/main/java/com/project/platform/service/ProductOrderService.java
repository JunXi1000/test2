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

    /**
     * 按**前端展示的订单标识**取该订单的行,并校验归属当前用户。
     *
     * <p>接受的形态(与前端展示一致):
     * <ul>
     *   <li>分组号 {@code orderNo} —— 真实订单。前端 {@code orders.ts} 把 {@code raw.orderNo}
     *       映射为 {@code order.id},而订单页展示的就是 {@code order.id};</li>
     *   <li>{@code LEGACY-{id}} —— 后端对 {@code order_no} 为空的旧行的分组展示名;</li>
     *   <li>纯数字行 id —— 兼容手工输入(退货页的订单号是文本框)。</li>
     * </ul>
     *
     * <p>归属规则与其它订单接口一致({@code AccessGuard.checkOrderOwner}):USER 比 userId、
     * SHOP 比 shopId、ADMIN 放行。
     *
     * @throws com.project.platform.exception.CustomException 订单不存在 → 404;不属于当前用户 → 403
     */
    List<ProductOrder> listOwnedOrderRows(String orderId);
}
