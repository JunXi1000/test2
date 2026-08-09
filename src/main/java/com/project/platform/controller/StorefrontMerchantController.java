package com.project.platform.controller;

import com.project.platform.entity.Product;
import com.project.platform.entity.Shop;
import com.project.platform.service.ProductService;
import com.project.platform.service.ShopService;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Public merchant/storefront API — matches frontend's /merchants/:id contract.
 */
@RestController
@RequestMapping("/merchants")
public class StorefrontMerchantController {

    @Resource
    private ShopService shopService;

    @Resource
    private ProductService productService;

    @GetMapping("/{merchantId}/profile")
    public ResponseVO<Map<String, Object>> getProfile(@PathVariable Integer merchantId) {
        Shop shop = shopService.selectById(merchantId);
        Map<String, Object> profile = new HashMap<>();
        if (shop == null) {
            profile.put("storeName", "Unknown Store");
            profile.put("verified", false);
            return ResponseVO.ok(profile);
        }
        profile.put("id", shop.getId().toString());
        profile.put("storeName", shop.getName());
        profile.put("avatar", shop.getAvatarUrl());
        profile.put("description", shop.getNickname());
        profile.put("verified", "启用".equals(shop.getStatus()));
        profile.put("joinedDate", shop.getCreateTime() != null ? shop.getCreateTime().toString() : "2024-01");
        profile.put("location", "Unknown");
        profile.put("responseTime", "< 1 hour");

        Map<String, Object> stats = new HashMap<>();
        stats.put("rating", 4.5);
        stats.put("totalReviews", 0);
        stats.put("totalProducts", 0);
        stats.put("totalSales", 0);
        stats.put("satisfactionRate", 95);
        stats.put("followers", 0);
        profile.put("stats", stats);

        Map<String, String> policies = new HashMap<>();
        policies.put("shipping", "Free shipping on orders over $50.");
        policies.put("returns", "30-day returns.");
        profile.put("policies", policies);

        profile.put("featuredProducts", Collections.emptyList());
        return ResponseVO.ok(profile);
    }

    @GetMapping("/{merchantId}/products")
    public ResponseVO<Map<String, Object>> getProducts(
            @PathVariable Integer merchantId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "12") Integer limit) {

        Map<String, Object> query = new HashMap<>();
        query.put("shopId", merchantId);
        if (q != null && !q.isEmpty()) query.put("name", q);
        PageVO<Product> pageVO = productService.page(query, page, limit);

        Map<String, Object> result = new HashMap<>();
        result.put("items", pageVO.getList());
        result.put("total", pageVO.getTotal());
        result.put("categories", List.of("All"));
        return ResponseVO.ok(result);
    }
}
