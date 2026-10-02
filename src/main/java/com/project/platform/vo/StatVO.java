package com.project.platform.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 仪表盘统计卡片。
 *
 * <p>字段与前端 {@code web/src/api/modules/adminDashboard.ts} 的 {@code AdminStat}、
 * {@code merchantDashboard.ts} 的 {@code MerchantStat} 一一对应(label/value/change/icon),
 * 故**不要**改名或增删字段 —— 那属于 API 契约变更。
 *
 * <p>{@code icon} 取值受前端字面量联合约束:
 * admin 是 {@code DollarSign|Users|ShoppingBag|Activity},merchant 是
 * {@code DollarSign|ShoppingCart|Package|TrendingUp}。
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class StatVO {

    /** 卡片标题,例如 "Total Revenue" */
    private String label;

    /** 已格式化的展示值(前端直接渲染,不参与计算) */
    private String value;

    /** 环比变化,例如 "+12.3%" / "-4.0%" */
    private String change;

    /** 图标字面量,见类注释 */
    private String icon;
}
