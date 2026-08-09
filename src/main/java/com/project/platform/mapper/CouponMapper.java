package com.project.platform.mapper;

import com.project.platform.entity.Coupon;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

public interface CouponMapper {

    /**
     * 可领取的券:启用中且未过期
     */
    @Select("SELECT * FROM coupon WHERE status = 'enabled' AND (expires_at IS NULL OR expires_at > NOW()) " +
            "ORDER BY id DESC")
    List<Coupon> selectEnabled();

    @Select("SELECT * FROM coupon WHERE id = #{id}")
    Coupon selectById(Integer id);

    @Select("SELECT * FROM coupon WHERE code = #{code} AND status = 'enabled' AND (expires_at IS NULL OR expires_at > NOW())")
    Coupon selectByCode(String code);

    @Update("UPDATE coupon SET claimed = claimed + 1 WHERE id = #{id}")
    int incrementClaimed(Integer id);
}
