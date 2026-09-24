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
     *
     * <p><b>必须带 LIMIT</b>:此前无上限,一次会把所有超时订单行载入内存;按 create_time 升序取,
     * 保证单轮处理的是最旧的一批,配合 60s 的 fixedDelay 逐批消化。
     * 注意 LIMIT 只决定「本轮注意到哪些 orderNo」—— 取消本身按 order_no 重新取整组,
     * 所以不会出现「只取消半个订单分组」。
     */
    @Select("SELECT * FROM product_order WHERE status = '待支付' AND order_no IS NOT NULL "
            + "AND create_time < #{cutoff} ORDER BY create_time LIMIT #{limit}")
    List<ProductOrder> selectPendingBefore(@Param("cutoff") LocalDateTime cutoff, @Param("limit") int limit);

    /**
     * 按订单分组号条件更新状态(fromStatus -> toStatus),返回受影响行数;用于幂等推进。
     */
    @Update("UPDATE product_order SET status = #{toStatus} WHERE order_no = #{orderNo} AND status = #{fromStatus}")
    int updateStatusByOrderNo(@Param("orderNo") String orderNo, @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus);

    /**
     * 按**行 id** 条件更新状态,返回受影响行数。
     *
     * <p>用途:取消订单时**抢占行所有权** —— 只有返回 1 的执行流才回补库存/退款,从而在
     * 并发(用户手动取消 vs 超时任务)下保证「回补一次、退款一次」。不用「先读状态再判断再写」,
     * 那种写法在无锁下可被两个执行流同时通过判断,导致重复退款。
     */
    @Update("UPDATE product_order SET status = #{toStatus} WHERE id = #{id} AND status = #{fromStatus}")
    int updateStatusById(@Param("id") Integer id, @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus);

    @Select("SELECT * FROM product_order WHERE status='已完成' and  create_time >= DATE_SUB(NOW(), INTERVAL #{day} DAY) ")
    List<ProductOrder> selectRecentlyCompleted(Integer day);
    @Select("SELECT * FROM product_order WHERE shop_id= #{shopId} and status='已完成' and  create_time >= DATE_SUB(NOW(), INTERVAL #{day} DAY) ")
    List<ProductOrder> selectRecentlyCompletedByShopId(Integer day, Integer shopId);

}
