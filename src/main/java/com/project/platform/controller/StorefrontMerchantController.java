package com.project.platform.controller;

import com.project.platform.entity.Product;
import com.project.platform.entity.ProductType;
import com.project.platform.entity.Shop;
import com.project.platform.exception.CustomException;
import com.project.platform.service.AnalyticsService;
import com.project.platform.service.ProductService;
import com.project.platform.service.ProductTypeService;
import com.project.platform.service.ShopService;
import com.project.platform.utils.PageParams;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import com.project.platform.vo.ShopPublicStatsVO;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Public merchant/storefront API — matches frontend's /merchants/:id contract.
 */
@RestController
@RequestMapping("/merchants")
public class StorefrontMerchantController {

    /** 店铺页精选商品条数,与前端 mock 分支的 4 条展示位一致 */
    private static final int FEATURED_PRODUCT_LIMIT = 4;

    @Resource
    private ShopService shopService;

    @Resource
    private ProductService productService;

    @Resource
    private ProductTypeService productTypeService;

    @Resource
    private AnalyticsService analyticsService;

    /**
     * GET /merchants/{merchantId}/profile
     *
     * <p><b>不编造数据</b>:没有的字段一律返回空串 / 0 / null,而不是填一个像模像样的常量。
     * 评分、销量、好评率是对买家可见的宣称,给一个假的 4.5 分属虚假宣传。
     * 曾经 {@code rating=4.5}、{@code satisfactionRate=95} 是写死的常量 —— 已修。
     *
     * <p>{@code location} / {@code responseTime} / {@code policies} 需要
     * {@code merchant_setting} 表才能持久化(属 TASK-000-D2,本轮无 schema 权限),
     * 故当前**如实返回空串**,等表落地后再读设置。
     */
    @GetMapping("/{merchantId}/profile")
    public ResponseVO<Map<String, Object>> getProfile(@PathVariable Integer merchantId) {
        Shop shop = shopService.selectById(merchantId);
        if (shop == null) {
            // 此前返回 200 + {"storeName":"Unknown Store"} —— 一个根本不存在的店铺被渲染成
            // 「Unknown Store」卡片。改为 404(已获总控批准):资源不存在就如实说不存在。
            throw new CustomException(HttpStatus.NOT_FOUND, "店铺不存在");
        }

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", shop.getId().toString());
        profile.put("storeName", shop.getName());
        profile.put("avatar", shop.getAvatarUrl());
        profile.put("description", shop.getNickname());
        profile.put("verified", "启用".equals(shop.getStatus()));
        profile.put("joinedDate", shop.getCreateTime() != null ? shop.getCreateTime().toString() : "");
        // 无设置表 → 如实返回空串,而不是编一句 "Unknown" / "< 1 hour"
        profile.put("location", "");
        profile.put("responseTime", "");

        // stats 全部来自 SQL 聚合(见 AnalyticsService.shopPublicStats)
        ShopPublicStatsVO stats = analyticsService.shopPublicStats(merchantId);
        stats.setFollowers(shop.getFansCount() == null ? 0 : shop.getFansCount());
        profile.put("stats", stats);

        // 同上:商家没填过政策就是空串,前端据此隐藏该区块
        Map<String, String> policies = new HashMap<>();
        policies.put("shipping", "");
        policies.put("returns", "");
        profile.put("policies", policies);

        // featuredProducts 此前恒为空列表,现取该店销量最高的在售商品。
        // 走**按店**的销量榜而非「全局榜再过滤」—— 否则小店铺永远挤不进前 N 而恒为空。
        profile.put("featuredProducts",
                productService.salesVolumeTopByShopId(merchantId, FEATURED_PRODUCT_LIMIT));
        return ResponseVO.ok(profile);
    }

    /**
     * GET /merchants/{merchantId}/products?category=&q=&page=&limit=
     *
     * <p>2026-09-27 修复两处「参数被接���却从不使用」:
     * {@code category} 此前完全不参与查询(店铺页分类筛选形同虚设),
     * {@code categories} 恒返回 {@code List.of("All")}(前端分类标签永远只有一项)。
     */
    @GetMapping("/{merchantId}/products")
    public ResponseVO<Map<String, Object>> getProducts(
            @PathVariable Integer merchantId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "12") Integer limit) {

        // 店铺不存在时返回 404,而不是一个空列表(与 profile 同一口径)
        if (shopService.selectById(merchantId) == null) {
            throw new CustomException(HttpStatus.NOT_FOUND, "店铺不存在");
        }

        Map<String, Object> query = new HashMap<>();
        query.put("shopId", merchantId);
        if (q != null && !q.isEmpty()) query.put("name", q);
        // 分类名 → 分类 id;查不到就**不按分类过滤**(而不是静默返回空集:
        // 前端分类值可能来自历史数据,直接清空结果会让人以为店铺没商品)
        if (category != null && !category.isEmpty() && !"All".equals(category)) {
            Integer typeId = resolveTypeId(category);
            if (typeId != null) {
                query.put("productTypeId", typeId);
            }
        }
        PageVO<Product> pageVO = productService.page(query, page, limit);

        Map<String, Object> result = new HashMap<>();
        result.put("items", pageVO.getList());
        result.put("total", pageVO.getTotal());
        // 真实分类列表:"All" + 该店实际有商品的分类
        result.put("categories", shopCategories(merchantId));
        return ResponseVO.ok(result);
    }

    /** 分类名 → 分类 id;找不到返回 null */
    private Integer resolveTypeId(String category) {
        for (ProductType type : productTypeService.list()) {
            if (type.getName().equals(category)) {
                return type.getId();
            }
        }
        return null;
    }

    /** 该店实际有商品的分类名(去重),首项固定 "All";一个都没有时只有 "All" */
    private List<String> shopCategories(Integer shopId) {
        Map<String, Object> query = new HashMap<>();
        query.put("shopId", shopId);
        List<String> names = productService.page(query, 1, PageParams.MAX_PAGE_SIZE)
                .getList().stream()
                .map(Product::getProductTypeName)
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .sorted()
                .toList();
        List<String> categories = new ArrayList<>(names.size() + 1);
        categories.add("All");
        categories.addAll(names);
        return categories;
    }
}
