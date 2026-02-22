package com.project.platform.mapper;

import com.project.platform.entity.ProductType;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ProductTypeMapper {
    List<ProductType> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM product_type WHERE id = #{id}")
    ProductType selectById(Integer id);

    @Select("SELECT * FROM product_type")
    List<ProductType> list();

    int insert(ProductType entity);

    int updateById(ProductType entity);

    boolean removeByIds(List<Integer> ids);

}
