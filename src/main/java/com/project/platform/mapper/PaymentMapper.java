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
     * 仅当 status='待支付' 时置为已支付并写流水号/支付时间;已支付/已取消/已超时返回 0。
     * 天然幂等:重复 confirm 不会重复改写或重复扣款。
     */
    @Update("UPDATE payment SET status = '已支付', transaction_no = #{transactionNo}, paid_time = #{paidTime} " +
            "WHERE order_no = #{orderNo} AND status = '待支付'")
    int updatePaid(@Param("orderNo") String orderNo, @Param("transactionNo") String transactionNo, @Param("paidTime") LocalDateTime paidTime);

    @Update("UPDATE payment SET status = #{status} WHERE order_no = #{orderNo}")
    int updateStatus(@Param("orderNo") String orderNo, @Param("status") String status);
}
