package com.project.platform.mapper;

import com.project.platform.entity.ProductOrder;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;


public interface ProductOrderMapper {
    List<ProductOrder> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM product_order WHERE id = #{id}")
    ProductOrder selectById(Integer id);

    @Select("SELECT * FROM product_order")
    List<ProductOrder> list();

    int insert(ProductOrder entity);

    int updateById(ProductOrder entity);

    boolean removeByIds(List<Integer> ids);
    /**
     * 查询最近已完成
     *
     * @param day
     * @return
     */
    /**
     * 按订单分组号查询(Phase 2 storefront 订单,多行同 order_no)
     */
    @Select("SELECT * FROM product_order WHERE order_no = #{orderNo} ORDER BY id")
    List<ProductOrder> selectByOrderNo(String orderNo);

    /**
     * 查询待支付且已超时(order_no 非空的 storefront 订单行),供自动取消任务使用。
     */
    @Select("SELECT * FROM product_order WHERE status = '待支付' AND order_no IS NOT NULL AND create_time < #{cutoff}")
    List<ProductOrder> selectPendingBefore(LocalDateTime cutoff);

    /**
     * 按订单分组号条件更新状态(fromStatus -> toStatus),返回受影响行数;用于幂等推进。
     */
    @Update("UPDATE product_order SET status = #{toStatus} WHERE order_no = #{orderNo} AND status = #{fromStatus}")
    int updateStatusByOrderNo(@Param("orderNo") String orderNo, @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus);

    @Select("SELECT * FROM product_order WHERE status='已完成' and  create_time >= DATE_SUB(NOW(), INTERVAL #{day} DAY) ")
    List<ProductOrder> selectRecentlyCompleted(Integer day);
    @Select("SELECT * FROM product_order WHERE shop_id= #{shopId} and status='已完成' and  create_time >= DATE_SUB(NOW(), INTERVAL #{day} DAY) ")
    List<ProductOrder> selectRecentlyCompletedByShopId(Integer day, Integer shopId);

}
