package com.project.platform.service;

import com.project.platform.entity.StockAlert;

import java.util.List;

/**
 * 到货订阅服务
 */
public interface StockAlertService {

    List<StockAlert> getByUserId(Integer userId);

    /**
     * 订阅(重复订阅时先删除旧记录再重建,刷新商品信息)
     */
    void subscribe(StockAlert alert);

    void unsubscribe(Integer userId, Integer productId);
}
