package com.project.platform.controller;

import com.project.platform.entity.ShippingAddress;
import com.project.platform.exception.CustomException;
import com.project.platform.service.ShippingAddressService;
import com.project.platform.utils.AccessGuard;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
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

    /**
     * PUT /addresses/:id/default — <b>未实现,如实返回 501</b>。
     *
     * <p>此前是纯 no-op 却返回 200,用户以为默认地址已切换(下单时仍取旧地址)。
     * 「设为默认」需要 {@code shipping_address.is_default} 列,该列由仓库里的
     * {@code sql/migrations/V10__product_status_and_default_address.sql} 引入,
     * **本轮未应用该迁移**,故无处落库。
     *
     * <p>先做归属校验再抛 501:归属不属于调用方的地址,无论是「无效」还是「未实现」,
     * 都不该与「这是你的地址但功能没做」得到同一个回答。
     */
    @PutMapping("/{id}/default")
    public ResponseVO<?> setDefaultAddress(@PathVariable Integer id) {
        ShippingAddress existing = shippingAddressService.selectById(id);
        AccessGuard.checkOwner(existing != null ? existing.getUserId() : null,
                CurrentUserThreadLocal.getCurrentUser(), "收货地址");
        throw new CustomException(HttpStatus.NOT_IMPLEMENTED,
                "设为默认地址尚未实现:无 is_default 列可落库(需应用 V10 迁移),本轮不写入(此前返回 200 是假成功)");
    }
}
