package com.project.platform.mapper;

import com.project.platform.entity.ReturnRequest;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface ReturnRequestMapper {

    @Select("SELECT * FROM return_request WHERE user_id = #{userId} ORDER BY id DESC")
    List<ReturnRequest> selectByUserId(Integer userId);

    @Select("SELECT * FROM return_request WHERE id = #{id}")
    ReturnRequest selectById(Integer id);

    @Insert("INSERT INTO return_request(user_id, order_id, product_title, product_image, reason, detail, " +
            "refund_amount, status) VALUES(#{userId}, #{orderId}, #{productTitle}, #{productImage}, " +
            "#{reason}, #{detail}, #{refundAmount}, 'pending')")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ReturnRequest entity);
}
