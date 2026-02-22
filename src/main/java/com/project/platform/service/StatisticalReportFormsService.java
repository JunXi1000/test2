package com.project.platform.service;


import com.project.platform.vo.EchartsDataVO;
import com.project.platform.vo.ValueNameVO;

import java.util.List;

public interface StatisticalReportFormsService {
    /**
     * 商品类型占比
     * @return
     */
    List<ValueNameVO> getProductTypeProportionOfChart();


    /**
     * 销售总额统计
     *
     * @param day
     */
    EchartsDataVO getProductSalesTotalAmountChart(int day);
}
