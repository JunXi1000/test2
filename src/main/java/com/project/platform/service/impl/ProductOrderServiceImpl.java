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
import com.project.platform.service.CouponService;
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
import java.math.RoundingMode;
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

    /** 优惠码校验与核销(Phase 1 已有 coupon 链路,本轮只把它接进下单流程) */
    @Resource
    private CouponService couponService;

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
     *
     * <p><b>金额诚信(2026-09-27 TASK-000-I)</b>:落单金额 = Σ(DB 价 × 数量) − 服务端校验通过的优惠。
     * 此前本方法<b>完全不应用任何优惠</b>,而 {@code /checkout/summary} 却展示
     * 「满减 + 运费 + 税」后的总额 —— 两者对不上。现在 summary 与本方法走**同一套**优惠校验,
     * 故 {@code summary.total == 本方法返回的 amount == Σ(product_order.total_money)}(AC-04)。
     *
     * <p>优惠在最后**按行比例分摊**(见 {@link #allocateDiscount}),保证
     * {@code Σ(各行 total_money) == 扣减后的应付总额}精确成立,不因四舍五入差一分。
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
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();

        // 先按 DB 价把各行落下来(doInsert 内部会用 product.price 重算 totalMoney,
        // 前端传的 price 一律忽略),落完才知道小计是多少,才能校验优惠门槛。
        BigDecimal gross = BigDecimal.ZERO;
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
            gross = gross.add(order.getTotalMoney());
        }

        // 优惠:与服务端校验绑定,前端传什么都只影响「用不用这张券」,不影响「减多少」
        BigDecimal discount = BigDecimal.ZERO;
        if (dto.getCode() != null && !dto.getCode().isBlank()) {
            Map<String, Object> coupon = couponService.applyByCode(dto.getCode(), gross, userId);
            discount = (BigDecimal) coupon.get("discount");
            if (discount.compareTo(gross) > 0) {
                discount = gross;                       // 兜底封顶:应付不得为负
            }
            // 核销:条件 UPDATE 抢占,受影响行数 0 = 被并发提交抢先核销 → 409,整个事务回滚
            couponService.redeem(userId, (Integer) coupon.get("couponIdRaw"));
        }

        // 把优惠按比例摊回各行,再逐行改写 total_money。
        // 不摊的话 Σ(各行 total_money) 仍是未折扣的 gross,与支付单 amount 对不上(AC-04.3)。
        applyDiscountToRows(orderNo, gross, discount);

        BigDecimal amount = gross.subtract(discount).setScale(2, RoundingMode.HALF_UP);

        // 支付单(待支付)
        Payment payment = new Payment();
        payment.setOrderNo(orderNo);
        payment.setUserId(userId);
        payment.setAmount(amount);
        payment.setChannel(dto.getChannel() == null || dto.getChannel().isBlank() ? "card" : dto.getChannel());
        payment.setStatus("待支付");
        payment.setCreateTime(LocalDateTime.now());
        paymentMapper.insert(payment);
        // 下单成功后清除对应购物车行(仅限当前用户的行,防御横向越权)
        if (dto.getCartItemIds() != null && !dto.getCartItemIds().isEmpty()) {
            shoppingCartMapper.removeByIdsOfUser(userId, dto.getCartItemIds());
        }
        return new StorefrontCheckoutResult(orderNo, amount);
    }

    /**
     * 把优惠额按各行占比分摊回 {@code product_order.total_money}(最大余额法 / Hare 配额)。
     *
     * <p><b>为什么不能用「最后一行兜掉舍入余数」</b>:那样当行数多、优惠额小时,
     * 前 n−1 行的四舍五入之和可能<b>超过</b>优惠额,末行分摊到负数 ——
     * 实测 {@code gross=4300.03, discount=0.51, rows=[1984.18, 1681.68, 633.86, 0.31]}
     * 会让 0.31 那行变成 <b>0.32</b>:优惠之后比原价还贵。这不是精度问题,是账不平。
     *
     * <p>本实现分三步:
     * <ol>
     *   <li>按 {@code 该行金额 / 小计 × 优惠额} 算精确份额(高精度),逐行<b>向下</b>取整到分;</li>
     *   <li>余下的分(总差额是整数分)按<b>小数部分从大到小</b>依次补给各行,每行最多补 1 分;</li>
     *   <li>补给后每行份额仍 ≤ 该行原价(因为 {@code 优惠 ≤ 小计} ⟹ 精确份额 ≤ 行金额,
     *       且补 1 分的前提是该行小数部分 &gt; 0)。</li>
     * </ol>
     * 结果:{@code Σ(各行) == 优惠额} 精确成立,且没有任何一行变贵。
     *
     * <p>{@code discount} 为 0 时直接跳过 —— 不去改写已正确的行,减少无谓的 UPDATE。
     */
    private void applyDiscountToRows(String orderNo, BigDecimal gross, BigDecimal discount) {
        if (discount == null || discount.signum() == 0 || gross.signum() == 0) {
            return;
        }
        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        if (rows == null || rows.isEmpty()) {
            return;
        }
        int n = rows.size();
        BigDecimal[] shares = new BigDecimal[n];
        BigDecimal[] remainders = new BigDecimal[n];
        BigDecimal allocated = BigDecimal.ZERO;
        BigDecimal hundred = new BigDecimal(100);

        for (int i = 0; i < n; i++) {
            BigDecimal exact = rows.get(i).getTotalMoney().multiply(discount)
                    .divide(gross, 8, RoundingMode.HALF_UP);
            BigDecimal floor = exact.setScale(2, RoundingMode.DOWN);
            shares[i] = floor;
            remainders[i] = exact.subtract(floor);
            allocated = allocated.add(floor);
        }

        // 还差多少分要补(优惠额是两位小数,补完后一定能整除)
        long unitsLeft = discount.subtract(allocated).movePointRight(2).longValueExact();
        if (unitsLeft > 0) {
            // 按小数部分从大到小排序,同值时按行序,保证结果确定可测
            Integer[] order = new Integer[n];
            for (int i = 0; i < n; i++) {
                order[i] = i;
            }
            java.util.Arrays.sort(order, (a, b) -> {
                int cmp = remainders[b].compareTo(remainders[a]);
                return cmp != 0 ? cmp : Integer.compare(a, b);
            });
            for (int k = 0; k < unitsLeft && k < n; k++) {
                shares[order[k]] = shares[order[k]].add(new BigDecimal("0.01"));
            }
        }

        for (int i = 0; i < n; i++) {
            BigDecimal lineAmount = rows.get(i).getTotalMoney().subtract(shares[i]);
            // 防御性下限:理论上 discount <= gross 保证这里不会为负,留一道以防上游口径变动
            if (lineAmount.signum() < 0) {
                lineAmount = BigDecimal.ZERO;
            }
            ProductOrder patch = new ProductOrder();
            patch.setId(rows.get(i).getId());
            patch.setTotalMoney(lineAmount);
            productOrderMapper.updateById(patch);
        }
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
     * 取消订单分组:回补库存 + 退款 + 支付单推进。
     *
     * <p><b>并发安全靠「抢占行所有权」</b>:每行先用条件 UPDATE({@link ProductOrderMapper#updateStatusById})
     * 抢占,**只有返回 1 的执行流**才回补库存/退款。此前是「先读状态 → 判断 → 再写」,在无锁、
     * 且 {@code cancelTimeoutOrder} 没有事务的情况下,用户手动取消与超时任务可以同时通过判断,
     * 造成**同一笔钱退两次**、库存回补两次。
     *
     * <p><b>退款去向按支付渠道分流</b>:只有 {@code channel=balance}(确实从余额扣过款)才
     * {@code topUp} 回余额;{@code card} 等网关渠道只把支付单置「已退款」而**不动余额**。
     * 此前不区分渠道一律 {@code topUp},而 card 支付从未扣过余额 —— 取消一笔 card 订单等于
     * **凭空增加用户余额**(且可反复下单-支付-取消来刷)。
     *
     * @param payStatus 支付单目标状态:用户取消 -> 已取消,超时自动取消 -> 已超时
     */
    private void cancelRows(String orderNo, List<ProductOrder> rows, String payStatus) {
        Payment payment = paymentMapper.selectByOrderNo(orderNo);
        boolean refundToBalance = payment != null && "balance".equals(payment.getChannel());

        for (ProductOrder row : rows) {
            // ① 已付款的行:抢占「待发货 → 已取消」;抢到就必须退款
            if (productOrderMapper.updateStatusById(row.getId(), "待发货", "已取消") == 1) {
                productService.in(row.getProductId(), row.getQuantity()); // 回补库存
                if (refundToBalance) {
                    userService.topUp(row.getUserId(), row.getTotalMoney()); // 余额渠道才回余额
                }
                continue;
            }
            // ② 未付款的行:抢占「待支付 → 已取消」;抢到只回补库存
            if (productOrderMapper.updateStatusById(row.getId(), "待支付", "已取消") == 1) {
                productService.in(row.getProductId(), row.getQuantity());
            }
            // 两条都抢不到 = 已被其它执行流处理,或已是终态 —— 什么都不做(幂等)
        }

        // 支付单推进:card 等渠道的退款只体现在支付单状态上(退款回原渠道)
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
     *
     * <p>与 {@link #cancelByOrderNo} 一样必须带事务 —— 它复用的 {@code cancelRows} 会跨
     * {@code product} / {@code user} / {@code product_order} / {@code payment} 四张表写。
     * 此前这里漏了 {@code @Transactional},同一条代码路径在用户手动取消时有事务、在超时
     * 任务里没有,是「重复退款」缺陷的另一半成因(另一半是 cancelRows 的读-判-写竞态,已改为
     * 条件 UPDATE 抢占行所有权)。
     */
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void cancelTimeoutOrder(String orderNo) {
        List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
        if (rows == null || rows.isEmpty()) {
            return;
        }
        cancelRows(orderNo, rows, "已超时");
    }

    /** 旧行(order_no 为空)在列表里的分组展示名前缀,与 {@code listStorefrontOrders} 一致 */
    private static final String LEGACY_ORDER_PREFIX = "LEGACY-";

    @Override
    public List<ProductOrder> listOwnedOrderRows(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "订单号不能为空");
        }
        List<ProductOrder> rows;
        if (orderId.startsWith(LEGACY_ORDER_PREFIX)) {
            rows = singleRowById(parseRowId(orderId.substring(LEGACY_ORDER_PREFIX.length())));
        } else if (orderId.chars().allMatch(Character::isDigit)) {
            rows = singleRowById(parseRowId(orderId));
        } else {
            rows = productOrderMapper.selectByOrderNo(orderId);
        }
        if (rows.isEmpty()) {
            throw new CustomException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        // 归属校验:与其它订单接口同一套规则(USER 比 userId、SHOP 比 shopId、ADMIN 放行)。
        // 注意用 mapper 而非本类 selectById —— 后者只取单行且语义不同。
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        for (ProductOrder row : rows) {
            AccessGuard.checkOrderOwner(row, current);
        }
        return rows;
    }

    private List<ProductOrder> singleRowById(Integer id) {
        ProductOrder row = (id == null) ? null : productOrderMapper.selectById(id);
        return row == null ? List.of() : List.of(row);
    }

    private Integer parseRowId(String raw) {
        try {
            return Integer.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            return null;   // 非法数字 → 当作"找不到该订单",由调用方抛 404
        }
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
        ProductOrder productOrder = selectById(id);   // 内含归属校验
        // 与 cancelRows 同一套做法:条件 UPDATE 抢占行所有权,只有抢到行的执行流才回补库存/退款,
        // 避免并发下重复回补/重复退款。此前是「先读状态 → 判断 → 再写」。
        if (productOrderMapper.updateStatusById(id, "待发货", "已取消") == 1) {
            productService.in(productOrder.getProductId(), productOrder.getQuantity());
            // 旧链路(无 payment 记录)的支付走的是余额扣款(pay(id) -> userService.consumption),
            // 所以退款回余额 —— 与 storefront 按 payment.channel 分流的规则一致,不是特例。
            userService.topUp(productOrder.getUserId(), productOrder.getTotalMoney());
            return;
        }
        if (productOrderMapper.updateStatusById(id, "待支付", "已取消") == 1) {
            productService.in(productOrder.getProductId(), productOrder.getQuantity());
            return;
        }
        // 两条都抢不到 = 已是终态(已取消/已完成等),与旧实现的语义一致
        throw new CustomException("数据已过期，请先刷新页面");
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
