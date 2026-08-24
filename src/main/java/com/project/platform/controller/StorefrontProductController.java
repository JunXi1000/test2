package com.project.platform.controller;

import com.project.platform.entity.Product;
import com.project.platform.entity.ProductType;
import com.project.platform.service.ProductService;
import com.project.platform.service.ProductTypeService;
import com.project.platform.utils.PageParams;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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

    /**
     * GET /products/{id}/related?limit= — 相关推荐:同分类商品(排除自身),不足补其他分类
     */
    @GetMapping("/{id}/related")
    public ResponseVO<List<Product>> related(@PathVariable Integer id,
                                             @RequestParam(defaultValue = "6") Integer limit) {
        Product current = productService.selectById(id);
        if (current == null) {
            return ResponseVO.ok(Collections.emptyList());
        }
        List<Product> all = productService.page(new HashMap<>(), 1, PageParams.MAX_PAGE_SIZE).getList();
        Integer typeId = current.getProductTypeId();
        List<Product> sameCat = new ArrayList<>();
        List<Product> others = new ArrayList<>();
        for (Product p : all) {
            if (p.getId().equals(id)) {
                continue;
            }
            if (typeId != null && typeId.equals(p.getProductTypeId())) {
                sameCat.add(p);
            } else {
                others.add(p);
            }
        }
        List<Product> result = new ArrayList<>(sameCat);
        for (Product p : others) {
            if (result.size() >= limit) {
                break;
            }
            result.add(p);
        }
        if (result.size() > limit) {
            result = result.subList(0, limit);
        }
        return ResponseVO.ok(result);
    }

    /**
     * GET /products/{id}/bought-together?limit= — 搭配购买:价格区间相近的商品(Frequently Bought Together)
     */
    @GetMapping("/{id}/bought-together")
    public ResponseVO<List<Product>> boughtTogether(@PathVariable Integer id,
                                                    @RequestParam(defaultValue = "3") Integer limit) {
        Product current = productService.selectById(id);
        if (current == null || current.getPrice() == null) {
            return ResponseVO.ok(Collections.emptyList());
        }
        List<Product> all = productService.page(new HashMap<>(), 1, PageParams.MAX_PAGE_SIZE).getList();
        BigDecimal lo = current.getPrice().multiply(new BigDecimal("0.35"));
        BigDecimal hi = current.getPrice().multiply(new BigDecimal("1.5"));
        List<Product> pool = all.stream()
                .filter(p -> !p.getId().equals(id))
                .filter(p -> p.getPrice() != null
                        && p.getPrice().compareTo(lo) >= 0
                        && p.getPrice().compareTo(hi) <= 0)
                .limit(limit)
                .collect(Collectors.toList());
        return ResponseVO.ok(pool);
    }

    /**
     * GET /products/{id}/complete-the-look?limit= — 结算页"Complete the Look":不同分类的价格相近商品(追加购买)
     */
    @GetMapping("/{id}/complete-the-look")
    public ResponseVO<List<Product>> completeTheLook(@PathVariable Integer id,
                                                     @RequestParam(defaultValue = "3") Integer limit) {
        Product current = productService.selectById(id);
        if (current == null || current.getPrice() == null) {
            return ResponseVO.ok(Collections.emptyList());
        }
        List<Product> all = productService.page(new HashMap<>(), 1, PageParams.MAX_PAGE_SIZE).getList();
        BigDecimal lo = current.getPrice().multiply(new BigDecimal("0.3"));
        BigDecimal hi = current.getPrice().multiply(new BigDecimal("1.8"));
        Integer typeId = current.getProductTypeId();
        List<Product> pool = all.stream()
                .filter(p -> !p.getId().equals(id))
                .filter(p -> typeId == null || !typeId.equals(p.getProductTypeId()))
                .filter(p -> p.getPrice() != null
                        && p.getPrice().compareTo(lo) >= 0
                        && p.getPrice().compareTo(hi) <= 0)
                .limit(limit)
                .collect(Collectors.toList());
        return ResponseVO.ok(pool);
    }
}
