package com.project.platform.controller;

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
 * Storefront product API — matches the frontend's expected /products contract.
 * Delegates to existing ProductService and ProductTypeService.
 */
@RestController
@RequestMapping("/products")
public class StorefrontProductController {

    @Resource
    private ProductService productService;

    @Resource
    private ProductTypeService productTypeService;

    /**
     * GET /products?category=&q=&sort=price-asc|price-desc|default&page=&limit=
     */
    @GetMapping
    public ResponseVO<List<Product>> getProducts(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "default") String sort,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer limit) {

        Map<String, Object> query = new HashMap<>();
        if (category != null && !category.isEmpty() && !"All".equals(category)) {
            // Map category name to productTypeId
            List<ProductType> types = productTypeService.list();
            for (ProductType pt : types) {
                if (pt.getName().equals(category)) {
                    query.put("productTypeId", pt.getId());
                    break;
                }
            }
        }
        if (q != null && !q.isEmpty()) {
            query.put("name", q);
        }

        PageVO<Product> pageVO = productService.page(query, page, limit);
        // Sort if needed (backend page returns default order)
        List<Product> list = pageVO.getList();
        if ("price-asc".equals(sort)) {
            list.sort(Comparator.comparing(Product::getPrice));
        } else if ("price-desc".equals(sort)) {
            list.sort(Comparator.comparing(Product::getPrice).reversed());
        }
        return ResponseVO.ok(list);
    }

    /**
     * GET /products/{id}
     */
    @GetMapping("/{id}")
    public ResponseVO<Product> getProductById(@PathVariable Integer id) {
        return ResponseVO.ok(productService.selectById(id));
    }

    /**
     * GET /products/category-counts
     */
    @GetMapping("/category-counts")
    public ResponseVO<Map<String, Integer>> getCategoryCounts() {
        List<ProductType> types = productTypeService.list();
        Map<String, Integer> counts = new LinkedHashMap<>();
        // Placeholder — could be wired to ProductMapper.selectTypeCount()
        counts.put("All", 0);
        for (ProductType pt : types) {
            counts.put(pt.getName(), 0);
        }
        return ResponseVO.ok(counts);
    }

    /**
     * GET /products/recommend/{size}
     */
    @GetMapping("/recommend/{size}")
    public ResponseVO<List<Product>> recommend(@PathVariable int size) {
        return ResponseVO.ok(productService.recommended(size));
    }

    /**
     * GET /products/sales-top/{size}
     */
    @GetMapping("/sales-top/{size}")
    public ResponseVO<List<Product>> salesTop(@PathVariable int size) {
        return ResponseVO.ok(productService.salesVolumeTop(size));
    }
}
