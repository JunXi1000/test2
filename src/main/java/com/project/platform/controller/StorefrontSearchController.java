package com.project.platform.controller;

import com.project.platform.dto.SearchRequestDTO;
import com.project.platform.entity.Product;
import com.project.platform.entity.ProductType;
import com.project.platform.service.AnalyticsService;
import com.project.platform.service.ProductService;
import com.project.platform.service.ProductTypeService;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Search API — matches frontend's expected /search contract.
 */
@RestController
@RequestMapping("/search")
public class StorefrontSearchController {

    /** 热门搜索词条数,与前端 mock 分支的展示宽度一致 */
    private static final int TRENDING_LIMIT = 10;

    /** 相关搜索词条数 */
    private static final int RELATED_LIMIT = 5;

    @Resource
    private ProductService productService;

    @Resource
    private ProductTypeService productTypeService;

    @Resource
    private AnalyticsService analyticsService;

    /**
     * GET /search/suggestions?q=
     */
    @GetMapping("/suggestions")
    public ResponseVO<Map<String, Object>> getSuggestions(@RequestParam String q) {
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> query = new HashMap<>();
        query.put("name", q);
        PageVO<Product> page = productService.page(query, 1, 6);
        List<Map<String, Object>> products = page.getList().stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("title", p.getName());
            m.put("price", p.getPrice());
            m.put("image", p.getMainImg());
            return m;
        }).collect(Collectors.toList());
        result.put("keywords", Collections.<String>emptyList());
        result.put("products", products);
        return ResponseVO.ok(result);
    }

    /**
     * GET /search/trending
     *
     * <p>2026-09-27 起为真实数据(此前是硬编码的 "Phone"/"Laptop"/… 固定数组):
     * 按 {@code product.sales_volume} 取销量最高的商品名,不足时用分类名补齐。
     * 库里完全没有销量数据时返回空列表 —— 前端渲染成空,不报错,也不编数据。
     */
    @GetMapping("/trending")
    public ResponseVO<List<String>> getTrending() {
        return ResponseVO.ok(analyticsService.trendingKeywords(TRENDING_LIMIT));
    }

    /**
     * POST /search — advanced search with filters
     */
    @PostMapping
    public ResponseVO<Map<String, Object>> search(@RequestBody SearchRequestDTO params) {
        Map<String, Object> query = new HashMap<>();
        String q = params.getQ();
        if (q != null && !q.isEmpty()) {
            query.put("name", q);
        }
        String category = params.getCategory();
        if (category != null && !category.isEmpty()) {
            Integer typeId = resolveTypeId(category);
            if (typeId != null) {
                query.put("productTypeId", typeId);
            }
        }

        // 原实现用 getIntValue 读(缺失得 0),再由「< 1 → 默认」收敛;此处 null 与 <1 同样收敛
        int page = params.getPage() == null ? 1 : params.getPage();
        if (page < 1) page = 1;
        int limit = params.getLimit() == null ? 20 : params.getLimit();
        if (limit < 1) limit = 20;

        PageVO<Product> pageVO = productService.page(query, page, limit);
        List<Product> products = pageVO.getList();

        // Sort
        String sort = params.getSort();
        if ("price-asc".equals(sort)) {
            products.sort(Comparator.comparing(Product::getPrice));
        } else if ("price-desc".equals(sort)) {
            products.sort(Comparator.comparing(Product::getPrice).reversed());
        }

        Integer typeId = params.getCategory() == null || params.getCategory().isEmpty()
                ? null
                : resolveTypeId(params.getCategory());

        Map<String, Object> result = new HashMap<>();
        result.put("products", products);
        result.put("total", pageVO.getTotal());
        // 2026-09-27:facets 由 AnalyticsService 真实聚合(此前恒为空 Map)。
        // 口径与前端 SearchResults.facets 一致:categories / priceRanges / ratings。
        result.put("facets", analyticsService.searchFacets(q, typeId));
        result.put("relatedSearches",
                analyticsService.relatedSearches(q, products, RELATED_LIMIT));
        return ResponseVO.ok(result);
    }

    /** 分类名 → 分类 id;找不到返回 null(此时不按分类过滤,而不是静默返回空集) */
    private Integer resolveTypeId(String category) {
        for (ProductType pt : productTypeService.list()) {
            if (pt.getName().equals(category)) {
                return pt.getId();
            }
        }
        return null;
    }
}
