package com.project.platform.service.impl;

import com.project.platform.entity.Product;
import com.project.platform.entity.ProductType;
import com.project.platform.mapper.AnalyticsMapper;
import com.project.platform.service.AnalyticsService;
import com.project.platform.service.ProductTypeService;
import com.project.platform.vo.CategoryCountVO;
import com.project.platform.vo.PriceBucketCountVO;
import com.project.platform.vo.PriceRangeCountVO;
import com.project.platform.vo.RatingCountVO;
import com.project.platform.vo.RevenuePointVO;
import com.project.platform.vo.SearchFacetsVO;
import com.project.platform.vo.ShopPublicStatsVO;
import com.project.platform.vo.ShopRatingVO;
import com.project.platform.vo.ShopRevenueVO;
import com.project.platform.vo.StatVO;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * {@link AnalyticsService} 的实现。
 *
 * <p>金额一律 {@link BigDecimal}:求和在 SQL 里做,比值与格式化在 Java 里做,
 * 任何一步都不下沉到 double。唯一的 double 是 {@code ShopPublicStatsVO.rating}
 * (评分均值,前端字段本身就是 number)。
 */
@Service
public class AnalyticsServiceImpl implements AnalyticsService {

    @Resource
    private AnalyticsMapper analyticsMapper;

    @Resource
    private ProductTypeService productTypeService;

    /** 金额卡片的展示币种。前端契约里就是 "$",与 mock 一致。 */
    private static final Locale DISPLAY_LOCALE = Locale.US;

    private static final DateTimeFormatter CHART_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 「已支付」时间窗:近 30 天 vs 再前 30 天,用于卡片的环比。 */
    private static final int TREND_WINDOW_DAYS = 30;

    /** 「Active Now」的回看窗口。库里没有 session 表,只能以「近期下单」近似在线。 */
    private static final int ACTIVE_NOW_HOURS = 24;

    private static final int REVENUE_CHART_MAX_DAYS = 31;

    /** 参与拆词的相关搜索,避免整页几千个商品都进内存 */
    private static final int RELATED_SCAN_LIMIT = 30;

    /** 拆词的最小长度,与前端 mock 分支一致(过短的词噪声太大) */
    private static final int RELATED_MIN_WORD_LENGTH = 3;

    // ══════════════════════ 管理端看板 ══════════════════════

    @Override
    public List<StatVO> adminDashboardStats() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime recentStart = now.minusDays(TREND_WINDOW_DAYS);
        LocalDateTime previousStart = now.minusDays(TREND_WINDOW_DAYS * 2L);

        List<StatVO> stats = new ArrayList<>(4);

        // 1) 累计营收(全部已支付订单,不限时间窗)
        BigDecimal revenue = orZero(analyticsMapper.sumPaidRevenue(null, null));
        BigDecimal revenueRecent = orZero(analyticsMapper.sumPaidRevenue(null, recentStart));
        BigDecimal revenuePrevious = orZero(analyticsMapper.sumPaidRevenue(null, previousStart));
        stats.add(new StatVO("Total Revenue", money(revenue),
                percentChange(revenueRecent, revenuePrevious), "DollarSign"));

        // 2) 启用用户数;环比用「新注册用户数」两个窗口相比
        int users = analyticsMapper.countEnabledUsers();
        int newUsersRecent = analyticsMapper.countUsersCreatedSince(recentStart);
        int newUsersPrevious = analyticsMapper.countUsersCreatedSince(previousStart) - newUsersRecent;
        // 这里换算的是「新增注册」而非用户总数本身(总数的历史快照不可得),
        // 故文案如实反映:本卡片展示存量,change 展示新增趋势。
        newUsersPrevious = Math.max(newUsersPrevious, 0);
        stats.add(new StatVO("Active Users", integer(users),
                percentChange(BigDecimal.valueOf(newUsersRecent), BigDecimal.valueOf(newUsersPrevious)),
                "Users"));

        // 3) 累计已支付**订单单数**(不是行数 —— 同一 order_no 有多行时只算一单,
        //    否则看板会显示 3 个订单而实际只下了 1 单,且与按单记账的钱包对不上)
        int orders = analyticsMapper.countDistinctPaidOrders(null, null);
        int ordersRecent = analyticsMapper.countDistinctPaidOrders(null, recentStart);
        int ordersPrevious = analyticsMapper.countDistinctPaidOrders(null, previousStart) - ordersRecent;
        ordersPrevious = Math.max(ordersPrevious, 0);
        stats.add(new StatVO("Sales", integer(orders),
                percentChange(BigDecimal.valueOf(ordersRecent), BigDecimal.valueOf(ordersPrevious)),
                "ShoppingBag"));

        // 4) 活跃度。
        //    ⚠️ label "Active Now" 是**前端契约的既有字面量**,改它属 API 契约变更。
        //    但它**不是**「当前在线人数」:库里没有 session 表、没有 last_login 字段,
        //    登录行为不可观测。本卡片如实统计的是「近 24 小时内**下过单**的去重用户数」,
        //    前端不应把它渲染成带「实时/在线」暗示的指标(已上报总控)。
        int activeNow = analyticsMapper.countDistinctOrderingUsers(now.minusHours(ACTIVE_NOW_HOURS));
        int activePrevious = analyticsMapper.countDistinctOrderingUsers(now.minusHours(ACTIVE_NOW_HOURS * 2L));
        stats.add(new StatVO("Active Now", integer(activeNow),
                // 基数极小,百分比会剧烈跳变;用绝对差值更有信息量
                signedCount(activeNow - activePrevious), "Activity"));

        return stats;
    }

    // ══════════════════════ 商家端看板 ══════════════════════

    @Override
    public List<StatVO> merchantDashboardStats(Integer shopId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime recentStart = now.minusDays(TREND_WINDOW_DAYS);
        LocalDateTime previousStart = now.minusDays(TREND_WINDOW_DAYS * 2L);

        List<StatVO> stats = new ArrayList<>(4);

        BigDecimal sales = orZero(analyticsMapper.sumPaidRevenue(shopId, null));
        BigDecimal salesRecent = orZero(analyticsMapper.sumPaidRevenue(shopId, recentStart));
        BigDecimal salesPrevious = orZero(analyticsMapper.sumPaidRevenue(shopId, previousStart));
        stats.add(new StatVO("Total Sales", money(sales),
                percentChange(salesRecent, salesPrevious), "DollarSign"));

        // 「Orders」是订单**单数**:同一 order_no 的多行只算一单(见 countDistinctPaidOrders 的
        // 注释)。用行数会让商家看到「3 个订单」而实际只下了 1 单,且与按单记账的钱包对不上。
        int orders = analyticsMapper.countDistinctPaidOrders(shopId, null);
        int ordersRecent = analyticsMapper.countDistinctPaidOrders(shopId, recentStart);
        int ordersPrevious = analyticsMapper.countDistinctPaidOrders(shopId, previousStart) - ordersRecent;
        ordersPrevious = Math.max(ordersPrevious, 0);
        stats.add(new StatVO("Orders", integer(orders),
                percentChange(BigDecimal.valueOf(ordersRecent), BigDecimal.valueOf(ordersPrevious)),
                "ShoppingCart"));

        int products = analyticsMapper.countProducts(shopId);
        // 商品数是存量指标:库里有 create_time,但「上一时点有多少在售商品」不可追溯,
        // 硬编一个环比反而是假数据。如实给 0%(前端 Package 卡片的 mock 本来也是 "0%")。
        stats.add(new StatVO("Products", integer(products), "+0%", "Package"));

        // 转化率 = 已支付订单 / 全部订单(0 单时为 0.0%,不抛除零)。
        // 分子分母**必须同量纲**:都用去重后的订单单数。
        int allOrders = analyticsMapper.countDistinctOrders(shopId);
        double conversion = ratio(orders, allOrders);
        int allRecent = ordersRecent; // 近似:已支付单数本身就在 allRecent 之内
        int allPrevious = Math.max(allOrders - allRecent, 0);
        double conversionRecent = ratio(ordersRecent, allRecent);
        double conversionPrevious = ratio(ordersPrevious, allPrevious);
        stats.add(new StatVO("Conversion Rate", percent(conversion),
                signedPercent(conversionRecent - conversionPrevious), "TrendingUp"));

        return stats;
    }

    // ══════════════════════ 收入曲线 ══════════════════════

    @Override
    public List<RevenuePointVO> adminRevenueChart(int days) {
        int span = Math.max(1, Math.min(days, REVENUE_CHART_MAX_DAYS));
        LocalDate lastDay = LocalDate.now();
        LocalDate firstDay = lastDay.minusDays(span - 1L);

        Map<LocalDate, BigDecimal> byDay = new HashMap<>();
        for (RevenuePointVO point : analyticsMapper.sumRevenueByDay(null, firstDay.atStartOfDay())) {
            if (point.getDate() == null) {
                continue;
            }
            // SQL 返回 DATE,驱动给的是 yyyy-MM-dd 字符串;解析失败就跳过该点而不是抛异常
            try {
                byDay.put(LocalDate.parse(point.getDate(), CHART_DATE), orZero(point.getValue()));
            } catch (RuntimeException ignored) {
                // 单点解析失败不应让整条曲线 500
            }
        }

        // 补齐没有订单的日期,否则 ECharts 的 category 轴会跳日
        List<RevenuePointVO> points = new ArrayList<>(span);
        for (int i = 0; i < span; i++) {
            LocalDate day = firstDay.plusDays(i);
            RevenuePointVO point = new RevenuePointVO();
            point.setDate(day.format(CHART_DATE));
            point.setValue(byDay.getOrDefault(day, BigDecimal.ZERO));
            points.add(point);
        }
        return points;
    }

    // ══════════════════════ 商家营收 ══════════════════════

    @Override
    public Map<Integer, BigDecimal> revenueByShop() {
        Map<Integer, BigDecimal> result = new HashMap<>();
        for (ShopRevenueVO row : analyticsMapper.sumRevenueByShop()) {
            if (row.getShopId() != null) {
                result.put(row.getShopId(), orZero(row.getRevenue()));
            }
        }
        return result;
    }

    // ══════════════════════ 分类计数 ══════════════════════

    @Override
    public Map<String, Integer> categoryCounts() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("All", analyticsMapper.countProducts(null));

        Map<String, Integer> byType = analyticsMapper.countByProductType(null, null).stream()
                .filter(c -> c.getName() != null)
                .collect(Collectors.toMap(CategoryCountVO::getName, CategoryCountVO::getCount, (a, b) -> b));

        // 走全量分类而不是只列有货的:分类栏要能展示 0 件的分类
        for (ProductType type : productTypeService.list()) {
            if (type.getName() != null) {
                counts.put(type.getName(), byType.getOrDefault(type.getName(), 0));
            }
        }
        return counts;
    }

    // ══════════════════════ 热门搜索 ══════════════════════

    @Override
    public List<String> trendingKeywords(int limit) {
        int size = Math.max(1, limit);
        List<String> keywords = new ArrayList<>(size);
        for (String name : analyticsMapper.topSellingProductNames(size)) {
            if (name != null && !name.isBlank() && !keywords.contains(name)) {
                keywords.add(name);
            }
            if (keywords.size() >= size) {
                return keywords;
            }
        }
        // 销量数据不足时用分类名兜底,别让「热门搜索」整块空掉
        for (ProductType type : productTypeService.list()) {
            if (keywords.size() >= size) {
                break;
            }
            String name = type.getName();
            if (name != null && !name.isBlank() && !keywords.contains(name)) {
                keywords.add(name);
            }
        }
        return keywords;
    }

    // ══════════════════════ 搜索分面 ══════════════════════

    @Override
    public SearchFacetsVO searchFacets(String keyword, Integer productTypeId) {
        SearchFacetsVO facets = new SearchFacetsVO();

        // 三个维度都只应用关键字,不带当前分类 —— 否则选了分类后其它分类计数全变 0
        facets.setCategories(analyticsMapper.countByProductType(keyword, null));

        facets.setPriceRanges(priceRanges(keyword));

        List<RatingCountVO> ratings = new ArrayList<>(3);
        for (int star : new int[]{4, 3, 2}) {
            int count = analyticsMapper.countProductsRatedAtLeast(star, keyword, null);
            // 与前端 mock 分支一致:只给命中最多的档位,避免出现三个 0
            if (count > 0) {
                ratings.add(new RatingCountVO(star, count));
            }
        }
        facets.setRatings(ratings);
        return facets;
    }

    /**
     * 桶序号 → 展示标签/上下界。
     *
     * <p>边界必须与 {@code AnalyticsMapper.xml} 里 priceBuckets 的 CASE 分支一一对应:
     * 0→[0,50) 1→[50,200) 2→[200,500) 3→[500,1000) 4→[1000,∞)。
     */
    private List<PriceRangeCountVO> priceRanges(String keyword) {
        // 下界用 null 表示「无下界」那一档的显示起点;上界 null 表示无上界
        BigDecimal[] lower = {
                BigDecimal.ZERO, new BigDecimal(50), new BigDecimal(200),
                new BigDecimal(500), new BigDecimal(1000)
        };
        BigDecimal[] upper = {
                new BigDecimal(50), new BigDecimal(200), new BigDecimal(500),
                new BigDecimal(1000), null
        };

        List<PriceBucketCountVO> buckets = analyticsMapper.countByPriceBucket(keyword, null);
        buckets.sort(Comparator.comparingInt(PriceBucketCountVO::getBucket));

        List<PriceRangeCountVO> ranges = new ArrayList<>(buckets.size());
        for (PriceBucketCountVO bucket : buckets) {
            int index = bucket.getBucket();
            if (bucket.getCount() <= 0 || index < 0 || index >= lower.length) {
                continue;
            }
            String label;
            if (upper[index] == null) {
                label = "Over " + money(lower[index]);
            } else if (index == 0) {
                label = "Under " + money(upper[index]);
            } else {
                label = money(lower[index]) + " - " + money(upper[index]);
            }
            PriceRangeCountVO range = new PriceRangeCountVO();
            range.setLabel(label);
            range.setMin(lower[index]);
            range.setMax(upper[index]);
            range.setCount(bucket.getCount());
            ranges.add(range);
        }
        return ranges;
    }

    @Override
    public List<String> relatedSearches(String rawQuery, List<Product> matched, int limit) {
        if (matched == null || matched.isEmpty() || limit <= 0) {
            return List.of();
        }
        String query = rawQuery == null ? "" : rawQuery.toLowerCase(Locale.ROOT);

        Map<String, Integer> frequency = new HashMap<>();
        for (int i = 0; i < Math.min(matched.size(), RELATED_SCAN_LIMIT); i++) {
            Product product = matched.get(i);
            String title = product.getName();
            if (title == null) {
                continue;
            }
            for (String token : title.toLowerCase(Locale.ROOT).split("\\s+")) {
                String word = token.trim();
                if (word.length() < RELATED_MIN_WORD_LENGTH || query.contains(word)) {
                    continue;
                }
                frequency.merge(word, 1, Integer::sum);
            }
        }

        // 频次倒序、同频次按字典序 —— 确定性排序,便于测试断言(前端 mock 用的是随机)
        return frequency.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .limit(limit)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    // ══════════════════════ 公开店铺页 ══════════════════════

    @Override
    public ShopPublicStatsVO shopPublicStats(Integer shopId) {
        ShopPublicStatsVO stats = new ShopPublicStatsVO();

        ShopRatingVO rating = analyticsMapper.statShopRating(shopId);
        if (rating != null) {
            // 无评价时 avgRating 为 null —— 展示成 0.0,而不是把 null 塞进 double 字段
            stats.setRating(rating.getAvgRating() == null
                    ? 0.0
                    : BigDecimal.valueOf(rating.getAvgRating())
                    .setScale(1, RoundingMode.HALF_UP).doubleValue());
            stats.setTotalReviews(rating.getTotalReviews());
            stats.setSatisfactionRate(rating.getSatisfactionRate());
        }

        stats.setTotalProducts(analyticsMapper.countProducts(shopId));
        stats.setTotalSales(analyticsMapper.sumSalesVolume(shopId));
        // followers 由调用方从 Shop.fansCount 填 —— 那里已经有实体,不必再查一次
        return stats;
    }

    // ══════════════════════ 格式化工具 ══════════════════════

    private BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    /** 金额展示:始终两位小数、千分位,例如 $45,231.89 */
    private String money(BigDecimal value) {
        return NumberFormat.getCurrencyInstance(DISPLAY_LOCALE).format(orZero(value));
    }

    /** 整数展示:千分位,例如 2,350 */
    private String integer(long value) {
        return NumberFormat.getIntegerInstance(DISPLAY_LOCALE).format(value);
    }

    /** 比率展示,0.0~100.0 的一位小数,例如 3.2% */
    private String percent(double ratio) {
        return String.format(DISPLAY_LOCALE, "%.1f%%", ratio);
    }

    /** 带符号的百分点差,例如 +1.1% */
    private String signedPercent(double delta) {
        return String.format(DISPLAY_LOCALE, "%+.1f%%", delta);
    }

    /** 带符号的计数差,例如 +12 / -3 */
    private String signedCount(long delta) {
        return delta >= 0 ? "+" + integer(delta) : "-" + integer(-delta);
    }

    /**
     * 环比百分比。基期为 0 时不返回 {@code +∞}:本期也为 0 → "+0%",
     * 本期有量 → "+100%"(表示「从无到有」,而不是编一个天文数字)。
     */
    private String percentChange(BigDecimal current, BigDecimal previous) {
        BigDecimal now = orZero(current);
        BigDecimal before = orZero(previous);
        if (before.signum() == 0) {
            return now.signum() == 0 ? "+0%" : "+100%";
        }
        BigDecimal delta = now.subtract(before)
                .multiply(BigDecimal.valueOf(100))
                .divide(before, 1, RoundingMode.HALF_UP);
        return (delta.signum() >= 0 ? "+" : "") + delta.toPlainString() + "%";
    }

    /** 安全除法:分母为 0 时返回 0.0 而不是 NaN / Infinity */
    private double ratio(int part, int total) {
        if (total <= 0) {
            return 0.0;
        }
        return BigDecimal.valueOf(part)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
