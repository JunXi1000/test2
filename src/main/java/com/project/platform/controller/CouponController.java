package com.project.platform.controller;

import com.project.platform.service.CouponService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 优惠券 API — matches frontend's expected /coupons contract.
 */
@RestController
@RequestMapping("/coupons")
public class CouponController {

    @Resource
    private CouponService couponService;

    /**
     * 可领取的优惠券目录
     */
    @GetMapping("")
    public ResponseVO<List<Map<String, Object>>> getCoupons() {
        return ResponseVO.ok(couponService.getClaimableCatalog());
    }

    /**
     * 领取优惠券
     */
    @PostMapping("/{id}/claim")
    public ResponseVO<?> claim(@PathVariable Integer id) {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        couponService.claim(userId, id);
        return ResponseVO.ok();
    }

    /**
     * 我的优惠券
     */
    @GetMapping("/my-coupons")
    public ResponseVO<List<Map<String, Object>>> getMyCoupons() {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        return ResponseVO.ok(couponService.getMyCoupons(userId));
    }
}
