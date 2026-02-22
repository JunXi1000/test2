package com.project.platform.mapper;

import com.project.platform.entity.ProductCollect;
import com.project.platform.entity.ShopCollect;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ShopCollectMapper {
    List<ShopCollect> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM shop_collect WHERE id = #{id}")
    ShopCollect selectById(Integer id);

    @Select("SELECT * FROM shop_collect")
    List<ShopCollect> list();

    int insert(ShopCollect entity);

    int updateById(ShopCollect entity);

    boolean removeByIds(List<Integer> ids);

    @Select("SELECT * FROM shop_collect WHERE shop_id = #{shopId} and user_id= #{userId}")
    ShopCollect selectByProductIdAndUserId(Integer shopId, Integer userId);

}
