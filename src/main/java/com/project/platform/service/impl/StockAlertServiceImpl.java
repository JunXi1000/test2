package com.project.platform.service.impl;

import com.project.platform.entity.StockAlert;
import com.project.platform.mapper.StockAlertMapper;
import com.project.platform.service.StockAlertService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 到货订阅服务
 */
@Service
public class StockAlertServiceImpl implements StockAlertService {

    @Resource
    private StockAlertMapper stockAlertMapper;

    @Override
    public List<StockAlert> getByUserId(Integer userId) {
        return stockAlertMapper.selectByUserId(userId);
    }

    @Override
    public void subscribe(StockAlert alert) {
        if (stockAlertMapper.selectByUserAndProduct(alert.getUserId(), alert.getProductId()) != null) {
            stockAlertMapper.deleteByUserAndProduct(alert.getUserId(), alert.getProductId());
        }
        stockAlertMapper.insert(alert);
    }

    @Override
    public void unsubscribe(Integer userId, Integer productId) {
        stockAlertMapper.deleteByUserAndProduct(userId, productId);
    }
}
