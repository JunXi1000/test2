package com.project.platform.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 收入曲线的一个数据点:某自然日的已支付金额合计。
 *
 * <p>对应前端 {@code RevenueData = { date: string; value: number }}。
 * {@code date} 已在服务层格式化为 {@code yyyy-MM-dd}(ECharts 直接当 category 轴标签用),
 * {@code value} 是 {@code BigDecimal} 由 Jackson 序列化为 JSON number。
 */
@Data
public class RevenuePointVO {

    /** 展示用日期标签,yyyy-MM-dd */
    private String date;

    /** 当日已支付金额合计(排除待支付/已取消) */
    private BigDecimal value;
}
