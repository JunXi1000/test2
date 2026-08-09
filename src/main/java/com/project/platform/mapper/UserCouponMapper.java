package com.project.platform.mapper;

import com.project.platform.entity.UserCoupon;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

public interface UserCouponMapper {

    @Select("SELECT * FROM user_coupon WHERE user_id = #{userId} ORDER BY id DESC")
    List<UserCoupon> selectByUserId(Integer userId);

    @Select("SELECT * FROM user_coupon WHERE user_id = #{userId} AND coupon_id = #{couponId}")
    UserCoupon selectByUserAndCoupon(Integer userId, Integer couponId);

    @Insert("INSERT INTO user_coupon(user_id, coupon_id, status) VALUES(#{userId}, #{couponId}, 'unused')")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(UserCoupon entity);

    @Update("UPDATE user_coupon SET status = 'used', used_time = NOW() WHERE id = #{id}")
    int markUsed(Integer id);
}
