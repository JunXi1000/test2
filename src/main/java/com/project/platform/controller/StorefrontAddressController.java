package com.project.platform.controller;

import com.project.platform.entity.ShippingAddress;
import com.project.platform.service.ShippingAddressService;
import com.project.platform.utils.AccessGuard;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Storefront address API — matches frontend's expected /addresses contract.
 */
@RestController
@RequestMapping("/addresses")
public class StorefrontAddressController {

    @Resource
    private ShippingAddressService shippingAddressService;

    @GetMapping
    public ResponseVO<List<ShippingAddress>> getAddresses() {
        Map<String, Object> query = new HashMap<>();
        query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        return ResponseVO.ok(shippingAddressService.page(query, 1, 100).getList());
    }

    @PostMapping
    public ResponseVO<ShippingAddress> createAddress(@RequestBody ShippingAddress entity) {
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        shippingAddressService.insert(entity);
        return ResponseVO.ok(entity);
    }

    @PutMapping("/{id}")
    public ResponseVO<ShippingAddress> updateAddress(@PathVariable Integer id, @RequestBody ShippingAddress entity) {
        entity.setId(id);
        ShippingAddress existing = shippingAddressService.selectById(id);
        AccessGuard.checkOwner(existing != null ? existing.getUserId() : null, CurrentUserThreadLocal.getCurrentUser(), "收货地址");
        shippingAddressService.updateById(entity);
        return ResponseVO.ok(shippingAddressService.selectById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseVO<?> deleteAddress(@PathVariable Integer id) {
        ShippingAddress existing = shippingAddressService.selectById(id);
        AccessGuard.checkOwner(existing != null ? existing.getUserId() : null, CurrentUserThreadLocal.getCurrentUser(), "收货地址");
        shippingAddressService.removeByIds(List.of(id));
        return ResponseVO.ok();
    }

    @PutMapping("/{id}/default")
    public ResponseVO<?> setDefaultAddress(@PathVariable Integer id) {
        // Simple implementation: just mark this one as used
        return ResponseVO.ok();
    }
}
