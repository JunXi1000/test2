package com.project.platform.service.impl;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.StorefrontCheckoutDTO;
import com.project.platform.entity.Payment;
import com.project.platform.entity.Product;
import com.project.platform.entity.ProductOrder;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.PaymentMapper;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.mapper.ShoppingCartMapper;
import com.project.platform.service.ProductOrderService;
import com.project.platform.service.ProductService;
import com.project.platform.service.UserService;
import com.project.platform.utils.AccessGuard;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.utils.OrderNoGenerator;
import com.project.platform.utils.PageParams;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.StorefrontCheckoutResult;
import com.project.platform.vo.StorefrontOrderVO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
    private PaymentMapper paymentMapper;

    @Resource
    private ShoppingCartMapper shoppingCartMapper;

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
        PageParams.Normalized p = PageParams.normalize(pageNum, pageSize);
        List<ProductOrder> list = productOrderMapper.queryPage(p.offset(), p.pageSize(), query);
        page.setList(list);
        page.setTotal(productOrderMapper.queryCount(query));
        return page;
    }

    @Override
    public ProductOrder selectById(Integer id) {
        ProductOrder productOrder = productOrderMapper.selectById(id);
        // 归属校验:USER 只能看自己的订单,SHOP 只能看本店铺订单,ADMIN 放行
        AccessGuard.checkOrderOwner(productOrder, CurrentUserThreadLocal.getCurrentUser());
        return productOrder;
    }

    @Override
    public List<ProductOrder> list() {
        return productOrderMapper.list();
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void insert(ProductOrder entity) {
        doInsert(entity);
    }

    /**
     * 下单核心:校验 USER 角色、生成/沿用 order_no、原子扣库存、服务端重算金额、落库。
     */
    private void doInsert(ProductOrder entity) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            throw new CustomException("普通用户才允许下单");
        }
        if (entity.getOrderNo() == null) {
            entity.setOrderNo(OrderNoGenerator.next());
        }
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        entity.setStatus("待支付");

        //商品出库(原子扣减库存,并发下不会超卖)
        productService.out(entity.getProductId(), entity.getQuantity());
        Product product = productService.selectById(entity.getProductId());
        entity.setShopId(product.getShopId());
        //设置订单金额，通过后端计算，保证安全性(BigDecimal 精确运算)
        entity.setTotalMoney(product.getPrice().multiply(BigDecimal.valueOf(entity.getQuantity())));
        check(entity);
        productOrderMapper.insert(entity);
    }

    @Override
    public void updateById(ProductOrder entity) {
        check(entity);
        // 归属校验:更新前按 id 取原订单校验归属(防御直接调用 updateById 的越权)
        if (entity.getId() != null) {
            AccessGuard.checkOrderOwner(productOrderMapper.selectById(entity.getId()), CurrentUserThreadLocal.getCurrentUser());
        }
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
     * 前台结算下单(Phase 2):一次结算一个 order_no 分组 + 一张支付单。
     * 逐 item 以 DB 价格落单、原子扣库存;成功后按当前用户清除对应购物车行。
     */
    @Transactional(rollbackFor = Exception.class)
    @Override
    public StorefrontCheckoutResult createStorefrontOrder(StorefrontCheckoutDTO dto) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            throw new CustomException("普通用户才允许下单");
        }
        List<StorefrontCheckoutDTO.Item> items = dto.getItems();
        if (items == null || items.isEmpty()) {
            throw new CustomException("请选择要购买的商品");
        }
        String orderNo = OrderNoGenerator.next();
        BigDecimal amount = BigDecimal.ZERO;
        for (StorefrontCheckoutDTO.Item item : items) {
            Integer productId = item.resolveProductId();
            Integer qty = item.getQuantity();
            if (productId == null || qty == null || qty <= 0) {
                throw new CustomException("商品参数不合法");
            }
            ProductOrder order = new ProductOrder();
            order.setOrderNo(orderNo);
            order.setProductId(productId);
            order.setQuantity(qty);
            if (dto.getShipping() != null) {
                order.setConsigneeName(dto.getShipping().getName());
                order.setConsigneeTel(dto.getShipping().getTel());
                order.setConsigneeAddress(dto.getShipping().getAddress());
            }
            order.setRemark(dto.getRemark());
            doInsert(order);
            amount = amount.add(order.getTotalMoney());
        }
        // 支付单(待支付)
        Payment payment = new Payment();
        payment.setOrderNo(orderNo);
        payment.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        payment.setAmount(amount);
        payment.setChannel(dto.getChannel() == null || dto.getChannel().isBlank() ? "card" : dto.getChannel());
        payment.setStatus("待支付");
        payment.setCreateTime(LocalDateTime.now());
        paymentMapper.insert(payment);
        // 下单成功后清除对应购物车行(仅限当前用户的行,防御横向越权)
        if (dto.getCartItemIds() != null && !dto.getCartItemIds().isEmpty()) {
            shoppingCartMapper.removeByIdsOfUser(CurrentUserThreadLocal.getCurrentUser().getId(), dto.getCartItemIds());
        }
        return new StorefrontCheckoutResult(orderNo, amount);
    }

    /**
     * 按订单分组号取消(Phase 2):归属校验 + 幂等取消(回补库存/退款/支付单推进)。
     */
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void cancelByOrderNo(String orderNo) {
        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        if (rows == null || rows.isEmpty()) {
            throw new CustomException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        // 归属校验:所有行都必须属于当前用户
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        for (ProductOrder row : rows) {
            AccessGuard.checkOrderOwner(row, current);
        }
        cancelRows(orderNo, rows, "已取消");
    }

    /**
     * 取消订单分组:回补库存 + 已付款退款 + 支付单推进,幂等(全已取消则直接返回)。
     * 无用户上下文可调用(超时任务),故行状态更新走 mapper 而非带归属校验的 updateById。
     *
     * @param payStatus 支付单目标状态:用户取消->已取消,超时自动取消->已超时
     */
    private void cancelRows(String orderNo, List<ProductOrder> rows, String payStatus) {
        boolean anyActive = rows.stream()
                .anyMatch(r -> "待支付".equals(r.getStatus()) || "待发货".equals(r.getStatus()));
        if (!anyActive) {
            return; // 幂等:全已取消/已完成,不再重复退款
        }
        for (ProductOrder row : rows) {
            if (!"待支付".equals(row.getStatus()) && !"待发货".equals(row.getStatus())) {
                continue;
            }
            productService.in(row.getProductId(), row.getQuantity()); // 回补库存
            if ("待发货".equals(row.getStatus())) {
                userService.topUp(row.getUserId(), row.getTotalMoney()); // 已付款退款
            }
            row.setStatus("已取消");
            productOrderMapper.updateById(row);
        }
        Payment payment = paymentMapper.selectByOrderNo(orderNo);
        if (payment != null) {
            if ("已支付".equals(payment.getStatus())) {
                paymentMapper.updateStatus(orderNo, "已退款");
            } else if ("待支付".equals(payment.getStatus())) {
                paymentMapper.updateStatus(orderNo, payStatus);
            }
        }
    }

    /**
     * 前台订单分组列表:复用 page()(USER 已按 userId 过滤),Java 内按 order_no 聚合。
     * 旧行(order_no 为空)各自成组,orderNo 展示为 LEGACY-{id}。
     */
    @Override
    public List<StorefrontOrderVO> listStorefrontOrders(Integer pageNum, Integer pageSize) {
        Map<String, Object> query = new LinkedHashMap<>();
        query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        PageVO<ProductOrder> page = page(query, pageNum, pageSize);

        Map<String, List<ProductOrder>> groups = new LinkedHashMap<>();
        for (ProductOrder row : page.getList()) {
            String key = (row.getOrderNo() != null && !row.getOrderNo().isEmpty())
                    ? row.getOrderNo() : "LEGACY-" + row.getId();
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
        }
        List<StorefrontOrderVO> result = new ArrayList<>();
        for (Map.Entry<String, List<ProductOrder>> e : groups.entrySet()) {
            result.add(toStorefrontOrderVO(e.getKey(), e.getValue()));
        }
        result.sort((a, b) -> {
            LocalDateTime ta = a.getCreateTime();
            LocalDateTime tb = b.getCreateTime();
            if (ta == null) {
                return tb == null ? 0 : 1;
            }
            if (tb == null) {
                return -1;
            }
            return tb.compareTo(ta);
        });
        return result;
    }

    private StorefrontOrderVO toStorefrontOrderVO(String key, List<ProductOrder> rows) {
        StorefrontOrderVO vo = new StorefrontOrderVO();
        ProductOrder head = rows.get(0);
        vo.setOrderNo(key);
        vo.setStatus(head.getStatus());
        vo.setCreateTime(head.getCreateTime());
        vo.setConsigneeName(head.getConsigneeName());
        vo.setConsigneeTel(head.getConsigneeTel());
        vo.setConsigneeAddress(head.getConsigneeAddress());
        vo.setTrackingNumber(head.getTrackingNumber());
        vo.setRemark(head.getRemark());
        BigDecimal total = BigDecimal.ZERO;
        int quantity = 0;
        List<StorefrontOrderVO.Item> items = new ArrayList<>();
        for (ProductOrder row : rows) {
            total = total.add(row.getTotalMoney());
            quantity += row.getQuantity();
            StorefrontOrderVO.Item item = new StorefrontOrderVO.Item();
            item.setId(row.getId());
            item.setProductId(row.getProductId());
            item.setProductName(row.getProductName());
            item.setProductMainImg(row.getProductMainImg());
            item.setTotalMoney(row.getTotalMoney());
            item.setQuantity(row.getQuantity());
            item.setStatus(row.getStatus());
            items.add(item);
        }
        vo.setTotalMoney(total);
        vo.setQuantity(quantity);
        vo.setItems(items);
        return vo;
    }

    /**
     * 超时自动取消(无用户上下文):回补库存 + 支付单置已超时。
     * 由 OrderTimeoutTask 调用,仅处理仍待支付的订单行。
     */
    @Override
    public void cancelTimeoutOrder(String orderNo) {
        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        if (rows == null || rows.isEmpty()) {
            return;
        }
        cancelRows(orderNo, rows, "已超时");
    }


    /**
     * 支付
     *
     * @param id
     */
    @Transactional(rollbackFor = Exception.class)
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
    @Transactional(rollbackFor = Exception.class)
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
    @Transactional(rollbackFor = Exception.class)
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
    @Transactional(rollbackFor = Exception.class)
    public void confirm(Integer id) {
        ProductOrder productOrder = selectById(id);
        if (!productOrder.getStatus().equals("待收货")) {
            throw new CustomException("数据已过期，请先刷新页面");
        }
        productOrder.setStatus("已完成");
        updateById(productOrder);
    }


}
