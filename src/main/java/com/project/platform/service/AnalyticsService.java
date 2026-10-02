package com.project.platform.service;

import com.project.platform.entity.Product;
import com.project.platform.vo.RevenuePointVO;
import com.project.platform.vo.SearchFacetsVO;
import com.project.platform.vo.ShopPublicStatsVO;
import com.project.platform.vo.StatVO;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 看板 / 目录聚合服务 —— 只读,全部落到 {@code AnalyticsMapper} 的 SQL。
 *
 * <p><b>它取代了什么</b>:`AdminApiController` / `MerchantApiController` /
 * `StorefrontSearchController` / `StorefrontProductController` /
 * `StorefrontMerchantController` 里原先硬编码的统计值(见 docs/MODULES.md §2 的占位清单)。
 *
 * <p><b>关于归属校验</b>:本服务的入参 {@code shopId} 一律由控制器从
 * {@code CurrentUserThreadLocal} 取当前登录者 id 传入,**不接受请求参数**,
 * 所以不存在横向越权面。公开端点(店铺页/搜索)传的是路径里的 id,本就不需要归属校验。
 * 真正需要「越权 403 / 不存在 404」的写端点由各自的既有 Service 负责(见 AccessGuard)。
 *
 * <p><b>金额</b>:全程 {@link BigDecimal},不经过 float/double;
 * 格式化只发生在最后一步(生成展示字符串),不参与任何再计算。
 */
public interface AnalyticsService {

    /**
     * 管理端看板的 4 张卡片。
     *
     * <p>口径见 {@code AdminApiController} 的卡片标签:
     * Total Revenue = 累计已支付金额;Active Users = 启用用户数;
     * Sales = 累计已支付订单行数;Active Now = 近 24 小时下过单的去重用户数。
     */
    List<StatVO> adminDashboardStats();

    /**
     * 商家端看板的 4 张卡片(全部按 {@code shopId} 过滤)。
     *
     * <p>Total Sales = 累计已支付金额;Orders = 累计已支付订单行数;
     * Products = 在售商品数;Conversion Rate = 已支付订单 / 全部订单 × 100。
     */
    List<StatVO> merchantDashboardStats(Integer shopId);

    /**
     * 收入曲线:最近 {@code days} 个**自然日**的已支付金额。
     *
     * <p>没有订单的日期会被补成 0(而不是从结果里省略),保证 ECharts 的 category 轴连续。
     *
     * @param days 回看天数,服务层收敛到 1~31
     */
    List<RevenuePointVO> adminRevenueChart(int days);

    /**
     * 各店铺累计销售额,key = shopId。
     * 没有已支付订单的店铺不在结果里,调用方按 {@code getOrDefault(id, 0)} 取值。
     */
    Map<Integer, BigDecimal> revenueByShop();

    /**
     * 分类商品数视图:key = 分类名,首项固定是 {@code "All"}(全站商品数)。
     *
     * <p>返回**全部**分类(含 0 件的),顺序与 {@code ProductTypeService.list()} 一致 ——
     * 分类栏要能展示"还没上架商品"的分类,只返回有货的分类会让分类栏忽长忽短。
     */
    Map<String, Integer> categoryCounts();

    /**
     * 热门搜索词:销量最高的商品名;不足 {@code limit} 条时用分类名补齐。
     * 店内无任何销量数据时返回空列表(前端渲染为空,不报错)。
     */
    List<String> trendingKeywords(int limit);

    /**
     * POST /search 的分面。
     *
     * @param keyword       关键字(可空)
     * @param productTypeId 当前选中的分类(仅用于「结果集本身」,**不**参与分面计数,见 SearchFacetsVO)
     */
    SearchFacetsVO searchFacets(String keyword, Integer productTypeId);

    /**
     * 相关搜索词:从命中商品标题里抽词。
     *
     * <p>刻意**不**做随机化(前端的 mock 分支用 {@code Math.random()} 打乱):
     * 同样的查询必须给出同样的结果,否则测试无法断言、用户也会看到闪变的推荐。
     *
     * @param rawQuery 用户原始查询词;其包含的词会被排除(避免推荐用户已经搜过的词)
     * @param matched  当前命中的商品(通常只有当前页)
     * @param limit    最多返回几条
     */
    List<String> relatedSearches(String rawQuery, List<Product> matched, int limit);

    /**
     * 公开店铺页的统计块。
     *
     * @param shopId 店铺 id
     */
    ShopPublicStatsVO shopPublicStats(Integer shopId);
}
