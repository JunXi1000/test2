package com.project.platform.mapper;

import com.project.platform.entity.Shop;
import com.project.platform.entity.User;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ShopMapper {
    List<Shop> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM shop WHERE id = #{id}")
    Shop selectById(Integer id);

    @Select("SELECT * FROM shop")
    List<Shop> list();

    int insert(Shop entity);

    int updateById(Shop entity);

    boolean removeByIds(List<Integer> ids);

    @Select("SELECT * FROM shop WHERE username = #{username}")
    Shop selectByUsername(String username);


    @Select("SELECT * FROM shop WHERE tel = #{tel}")
    Shop selectByTel(String tel);

}
