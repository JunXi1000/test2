package com.project.platform.mapper;

import com.project.platform.entity.StockAlert;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface StockAlertMapper {

    @Select("SELECT * FROM stock_alert WHERE user_id = #{userId} ORDER BY id DESC")
    List<StockAlert> selectByUserId(Integer userId);

    @Select("SELECT * FROM stock_alert WHERE user_id = #{userId} AND product_id = #{productId}")
    StockAlert selectByUserAndProduct(Integer userId, Integer productId);

    @Insert("INSERT INTO stock_alert(user_id, product_id, product_title, product_image, email, status) " +
            "VALUES(#{userId}, #{productId}, #{productTitle}, #{productImage}, #{email}, 'active')")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(StockAlert entity);

    @Delete("DELETE FROM stock_alert WHERE user_id = #{userId} AND product_id = #{productId}")
    int deleteByUserAndProduct(Integer userId, Integer productId);
}
