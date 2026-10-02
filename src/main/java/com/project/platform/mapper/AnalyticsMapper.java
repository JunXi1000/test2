package com.project.platform.mapper;

import com.project.platform.vo.CategoryCountVO;
import com.project.platform.vo.PriceBucketCountVO;
import com.project.platform.vo.RevenuePointVO;
import com.project.platform.vo.ShopRatingVO;
import com.project.platform.vo.ShopRevenueVO;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 看板 / 目录聚合查询(只读,全部为 SELECT)。
 *
 * <p>这些 SQL 取代了原先硬编码在 {@code AdminApiController} / {@code MerchantApiController} /
 * {@code StorefrontSearchController} / {@code StorefrontProductController} /
 * {@code StorefrontMerchantController} 里的假数据。
 *
 * <p><b>为什么单独一个 mapper</b>:这些聚合查询横跨 product_order / product / user /
 * product_order_evaluate 四张表,放进任何一个既有 mapper 都会让它同时承担「该实体的 CRUD」
 * 与「跨表看板」两种职责。故新建本接口 —— 既有的 {@code ProductMapper} /
 * {@code ProductOrderMapper} 等一行未动。
 *
 * <p><b>「已支付」的口径</b>:SQL 片段 {@code paidOrderFilter} 用**白名单**
 * {@code status IN ('待发货','待收货','已完成')} 而不是
 * {@code NOT IN ('待支付','已取消')}。白名单是 fail-closed 的:将来新增任何状态
 * (例如「退款中」)都默认**不计入**收入,不会被误算成营收。要改口径只改这一处片段。
 *
 * <p>所有金额返回 {@link BigDecimal},聚合无行时由 {@code COALESCE(...,0)} 兜底成 0,
 * 服务层不需要判空。
 */
public interface AnalyticsMapper {

    // ── 收入 / 订单 ────────────────────────────────────────────────────

    /**
     * 已支付金额合计。
     *
     * @param shopId 店铺 id;传 null 表示全站
     * @param since  起始时间(含);传 null 表示不限时间(累计)
     * @return 无匹配行时为 0(不返回 null)
     */
    BigDecimal sumPaidRevenue(@Param("shopId") Integer shopId, @Param("since") LocalDateTime since);

    /**
     * 已支付订单行数(注:product_order 是「一行一商品」的扁平表,同一 order_no 会有多行,
     * 所以这里数的是**订单行**而非订单单数)。
     *
     * @param shopId 店铺 id;null = 全站
     * @param since  起始时间(含);null = 不限
     */
    int countPaidOrders(@Param("shopId") Integer shopId, @Param("since") LocalDateTime since);

    /**
     * 已支付订单**单数**(不是行数)。
     *
     * <p>{@code product_order} 是「一行一商品」的扁平表,同一 {@code order_no} 会有多行,
     * 所以 {@link #countPaidOrders} 数的是订单**行**。看板上的「订单数 / Sales」必须用本方法,
     * 否则商家会看到「3 个订单」而实际只下了 1 单 —— 更糟的是**看板与钱包对不上**
     * (钱包按单记账,看板按行计)。
     *
     * <p><b>存量兜底</b>:Phase 2 之前的订单行 {@code order_no} 可能为 NULL,各自成组。
     * {@code COUNT(DISTINCT order_no)} 会**跳过 NULL**,导致这些历史订单被整批漏计(统计偏低)。
     * 故统一用 {@code COALESCE(order_no, CONCAT('legacy-', id))} 做去重键 ——
     * NULL 行退化成「每个 id 一个独立分组」,正是它们本来的语义。
     *
     * @param shopId 店铺 id;null = 全站
     * @param since  起始时间(含);null = 不限
     */
    int countDistinctPaidOrders(@Param("shopId") Integer shopId, @Param("since") LocalDateTime since);

    /**
     * 全部状态的订单**单数** —— 作为商家「转化率」的分母。
     * 与 {@link #countDistinctPaidOrders} 同一去重键口径,否则分子分母不同量纲。
     *
     * @param shopId 店铺 id;null = 全站
     */
    int countDistinctOrders(@Param("shopId") Integer shopId);

    /**
     * 全部状态的订单行数。保留用于「Total Orders」这类明确按行计的指标。
     *
     * @param shopId 店铺 id;null = 全站
     */
    int countOrders(@Param("shopId") Integer shopId);

    /**
     * 按自然日聚合的已支付金额。服务层据此补齐没有订单的日期(填 0),保证曲线连续。
     *
     * @param shopId 店铺 id;null = 全站
     * @param since  起始时间(含)
     */
    List<RevenuePointVO> sumRevenueByDay(@Param("shopId") Integer shopId, @Param("since") LocalDateTime since);

    /**
     * 每个有已支付订单的店铺的累计销售额(管理端商家列表用)。
     * 没有订单的店铺不在结果里,由服务层按 0 兜底。
     */
    List<ShopRevenueVO> sumRevenueByShop();

    // ── 计数 ──────────────────────────────────────────────────────────

    /** 商品数;{@code shopId} 为 null 时为全站商品数 */
    int countProducts(@Param("shopId") Integer shopId);

    /** 启用状态(「启用」)的用户数 */
    int countEnabledUsers();

    /**
     * 起始时间(含)之后注册的用户数 —— 「Active Users」卡片的环比分子。
     */
    int countUsersCreatedSince(@Param("since") LocalDateTime since);

    /**
     * 店铺商品累计销量(sales_volume 之和),单位「件」。
     * 用它而不是订单行数来表达「totalSales」:前端店铺页的 totalSales 语义是**卖出的件数**。
     */
    int sumSalesVolume(@Param("shopId") Integer shopId);

    /**
     * 指定时间窗内**下过单**的去重用户数。
     *
     * <p>这是「活跃」的唯一可算口径:库里没有 session / last_login 表,登录行为不可观测。
     * 与其编一个「当前在线人数」,不如如实统计「近 N 小时内有下单行为的用户」。
     */
    int countDistinctOrderingUsers(@Param("since") LocalDateTime since);

    // ── 目录 / 搜索 ───────────────────────────────────────────────────

    /**
     * 按分类分组的商品数。
     *
     * <p>只返回**至少有一个商品**的分类(与 INNER JOIN 一致);前端若需要展示 0 件的分类,
     * 由服务层拿 product_type 全集补齐。
     *
     * @param keyword       商品名模糊匹配,null/空 = 不过滤
     * @param productTypeId 分类 id,null = 不过滤
     */
    List<CategoryCountVO> countByProductType(@Param("keyword") String keyword,
                                             @Param("productTypeId") Integer productTypeId);

    /**
     * 价格区间分桶计数。桶序号见 {@link PriceBucketCountVO#getBucket()} 的取值说明。
     *
     * @param keyword       商品名模糊匹配,null/空 = 不过滤
     * @param productTypeId 分类 id,null = 不过滤
     */
    List<PriceBucketCountVO> countByPriceBucket(@Param("keyword") String keyword,
                                                @Param("productTypeId") Integer productTypeId);

    /**
     * 「评分 ≥ N 星」的商品数(去重到商品)。
     *
     * <p>评分存在 {@code product_order_evaluate.rate} 上、只挂 product_id,
     * 故需经 product 关联;一个商品有多条评价时按商品去重,取其**任一**评价达标即计入。
     *
     * @param minRate       评分下限(含)
     * @param keyword       商品名模糊匹配,null/空 = 不过滤
     * @param productTypeId 分类 id,null = 不过滤
     */
    int countProductsRatedAtLeast(@Param("minRate") int minRate,
                                  @Param("keyword") String keyword,
                                  @Param("productTypeId") Integer productTypeId);

    /**
     * 热门搜索词候选:销量最高的商品名(销量为 0 的不作为「热门」)。
     * 服务层在结果不足时用分类名补齐。
     */
    List<String> topSellingProductNames(@Param("limit") int limit);

    // ── 店铺公开页 ────────────────────────────────────────────────────

    /**
     * 店铺评价聚合(经 product 关联到 shop)。
     * 无评价时 avgRating 为 null、totalReviews / satisfactionRate 为 0。
     */
    ShopRatingVO statShopRating(@Param("shopId") Integer shopId);
}
