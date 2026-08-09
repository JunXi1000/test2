package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.entity.Product;
import com.project.platform.entity.ProductType;
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

    @Resource
    private ProductService productService;

    @Resource
    private ProductTypeService productTypeService;

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
     */
    @GetMapping("/trending")
    public ResponseVO<List<String>> getTrending() {
        // Return trending keywords — placeholder
        List<String> trending = Arrays.asList("Phone", "Laptop", "Headphones", "Watch", "Camera");
        return ResponseVO.ok(trending);
    }

    /**
     * POST /search — advanced search with filters
     */
    @PostMapping
    public ResponseVO<Map<String, Object>> search(@RequestBody JSONObject params) {
        Map<String, Object> query = new HashMap<>();
        String q = params.getString("q");
        if (q != null && !q.isEmpty()) {
            query.put("name", q);
        }
        String category = params.getString("category");
        if (category != null && !category.isEmpty()) {
            List<ProductType> types = productTypeService.list();
            for (ProductType pt : types) {
                if (pt.getName().equals(category)) {
                    query.put("productTypeId", pt.getId());
                    break;
                }
            }
        }

        int page = params.getIntValue("page");
        if (page < 1) page = 1;
        int limit = params.getIntValue("limit");
        if (limit < 1) limit = 20;

        PageVO<Product> pageVO = productService.page(query, page, limit);
        List<Product> products = pageVO.getList();

        // Sort
        String sort = params.getString("sort");
        if ("price-asc".equals(sort)) {
            products.sort(Comparator.comparing(Product::getPrice));
        } else if ("price-desc".equals(sort)) {
            products.sort(Comparator.comparing(Product::getPrice).reversed());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("products", products);
        result.put("total", pageVO.getTotal());
        result.put("facets", new HashMap<>());
        result.put("relatedSearches", Collections.emptyList());
        return ResponseVO.ok(result);
    }
}
