package com.project.platform.mapper;

import com.project.platform.entity.Advertising;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface AdvertisingMapper {
    List<Advertising> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM advertising WHERE id = #{id}")
    Advertising selectById(Integer id);

    @Select("SELECT * FROM advertising")
    List<Advertising> list();

    int insert(Advertising entity);

    int updateById(Advertising entity);

    boolean removeByIds(List<Integer> ids);

}
