package com.project.platform.service.impl;

import com.project.platform.entity.ProductOrder;
import com.project.platform.mapper.ProductMapper;
import com.project.platform.mapper.ProductOrderMapper;
import com.project.platform.service.StatisticalReportFormsService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.utils.TimeUtils;
import com.project.platform.vo.EchartsDataVO;
import com.project.platform.vo.ValueNameVO;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class StatisticalReportFormsServiceImpl implements StatisticalReportFormsService {
    @Resource
    private ProductOrderMapper productOrderMapper;
    @Resource
    private ProductMapper productMapper;


    public List<ValueNameVO> getProductTypeProportionOfChart() {
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("SHOP")) {
            return productMapper.selectTypeCountByShopId(CurrentUserThreadLocal.getCurrentUser().getId());
        }
        return productMapper.selectTypeCount();
    }


    public EchartsDataVO getProductSalesTotalAmountChart(int day) {
        //查询数据库中的数据
        List<ProductOrder> productOrderList;
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("SHOP")) {
            productOrderList = productOrderMapper.selectRecentlyCompletedByShopId(day, CurrentUserThreadLocal.getCurrentUser().getId());
        } else {
            productOrderList = productOrderMapper.selectRecentlyCompleted(day);
        }

        List<LocalDateTime> recentSevenDays = TimeUtils.getRecentSevenDays(day);
        EchartsDataVO echartsDataVO = new EchartsDataVO();
        for (LocalDateTime localDateTime : recentSevenDays) {
            echartsDataVO.getXData().add(TimeUtils.formatterDate(localDateTime));
            float sum = 0;
            for (ProductOrder productOrder : productOrderList) {
                if (productOrder.getCreateTime().isBefore(TimeUtils.setToEndOfDay(localDateTime))
                        && (productOrder.getCreateTime().isAfter(TimeUtils.setToMidnight(localDateTime))
                        || productOrder.getCreateTime().equals(TimeUtils.setToMidnight(localDateTime)))) {
                    sum += productOrder.getTotalMoney();
                }
            }
            echartsDataVO.getSeriesData().add(sum);
        }
        return echartsDataVO;
    }


}
