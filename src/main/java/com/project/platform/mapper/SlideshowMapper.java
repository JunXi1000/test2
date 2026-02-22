package com.project.platform.mapper;

import com.project.platform.entity.Slideshow;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface SlideshowMapper {
    List<Slideshow> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM slideshow WHERE id = #{id}")
    Slideshow selectById(Integer id);

    @Select("SELECT * FROM slideshow")
    List<Slideshow> list();

    int insert(Slideshow entity);

    int updateById(Slideshow entity);

    boolean removeByIds(List<Integer> ids);

}
