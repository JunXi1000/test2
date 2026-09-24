package com.project.platform.mapper;

import com.project.platform.entity.Payment;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

public interface PaymentMapper {
    @Insert("INSERT INTO payment (order_no, user_id, amount, channel, transaction_no, status, paid_time, create_time) " +
            "VALUES (#{orderNo}, #{userId}, #{amount}, #{channel}, #{transactionNo}, #{status}, #{paidTime}, #{createTime})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Payment entity);

    @Select("SELECT * FROM payment WHERE order_no = #{orderNo}")
    Payment selectByOrderNo(String orderNo);

    /**
     * 仅当 status='待支付' 时置为已支付,并写**实际扣款渠道**、流水号、支付时间;已支付/已取消/已超时返回 0。
     * 天然幂等:重复 confirm 不会重复改写或重复扣款。
     *
     * <p>必须同时写 {@code channel}:建单时请求体给的渠道与 confirm 时实际使用的渠道可以不同
     * ({@code PaymentServiceImpl} 的 effectiveChannel 逻辑允许覆盖),而**扣款与否是按
     * effectiveChannel 决定的**。若不把实际渠道落库,{@code payment.channel} 就会与实际资金流向不符 ——
     * 取消退款时按渠道分流就会判错(把「实际从余额扣款」的单子当成网关单,钱退不回余额)。
     */
    @Update("UPDATE payment SET status = '已支付', channel = #{channel}, transaction_no = #{transactionNo}, paid_time = #{paidTime} " +
            "WHERE order_no = #{orderNo} AND status = '待支付'")
    int updatePaid(@Param("orderNo") String orderNo, @Param("channel") String channel,
                   @Param("transactionNo") String transactionNo, @Param("paidTime") LocalDateTime paidTime);

    @Update("UPDATE payment SET status = #{status} WHERE order_no = #{orderNo}")
    int updateStatus(@Param("orderNo") String orderNo, @Param("status") String status);
}
