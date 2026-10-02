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

    /**
     * 条件核销:仅当该券**当前未使用**时才置为已使用,返回受影响行数。
     *
     * <p>结算链路必须用本方法而不是 {@link #markUsed}:后者无条件改写,
     * 同一张券被并发提交两次时两次都会「成功」—— 一张券核销两次 = 优惠被重复享受。
     * 本方法用 {@code status='unused'} 做乐观锁,只有抢到的那条执行流拿到 1,
     * 其余拿到 0 并被上层拒绝(<b>同一张券并发核销只能成功一次</b>)。
     */
    @Update("UPDATE user_coupon SET status = 'used', used_time = NOW() WHERE id = #{id} AND status = 'unused'")
    int markUsedIfUnused(Integer id);
}
