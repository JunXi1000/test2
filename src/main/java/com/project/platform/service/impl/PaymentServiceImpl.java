package com.project.platform.service.impl;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.Payment;
import com.project.platform.entity.ProductOrder;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.PaymentMapper;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.service.PaymentService;
import com.project.platform.service.ProductOrderService;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 支付服务(Phase 2 模拟网关)。
 * - channel=card:模拟银行卡网关,不改余额,直接把订单行推进到待发货;
 * - channel=balance:走钱包余额,逐行扣款(productOrderService.pay)后推进到待发货。
 * 幂等由 payment.status 守卫:已支付直接返回成功,重复 confirm 不重复扣款。
 */
@Service
public class PaymentServiceImpl implements PaymentService {
    @Resource
    private PaymentMapper paymentMapper;

    @Resource
    private ProductOrderMapper productOrderMapper;

    @Resource
    private ProductOrderService productOrderService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void confirm(String orderNo, String channel) {
        Payment payment = paymentMapper.selectByOrderNo(orderNo);
        if (payment == null) {
            throw new CustomException(HttpStatus.NOT_FOUND, "支付单不存在");
        }
        // 归属校验:支付单必须属于当前用户
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        if (current != null && !"ADMIN".equals(current.getType())
                && (payment.getUserId() == null || !payment.getUserId().equals(current.getId()))) {
            throw new CustomException(HttpStatus.FORBIDDEN, "无权支付该订单");
        }
        if ("已支付".equals(payment.getStatus())) {
            return; // 幂等:已支付直接返回成功
        }
        if ("已取消".equals(payment.getStatus()) || "已超时".equals(payment.getStatus())) {
            throw new CustomException("订单已取消或已超时,无法支付");
        }
        String effectiveChannel = (channel == null || channel.isBlank()) ? payment.getChannel() : channel;
        if ("balance".equals(effectiveChannel)) {
            // 钱包余额支付:逐行扣款并推进到待发货(同一事务)
            List<ProductOrder> rows = productOrderMapper.selectByOrderNo(orderNo);
            for (ProductOrder row : rows) {
                productOrderService.pay(row.getId());
            }
        } else {
            // 模拟银行卡网关:不改余额,订单行 待支付 -> 待发货
            productOrderMapper.updateStatusByOrderNo(orderNo, "待支付", "待发货");
        }
        paymentMapper.updatePaid(orderNo, "TXN-" + orderNo, LocalDateTime.now());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void complete(String orderNo) {
        Payment payment = paymentMapper.selectByOrderNo(orderNo);
        if (payment == null) {
            throw new CustomException(HttpStatus.NOT_FOUND, "支付单不存在");
        }
        confirm(orderNo, payment.getChannel());
    }
}
