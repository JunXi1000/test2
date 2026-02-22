package com.project.platform.mapper;

import com.project.platform.entity.ProductOrderEvaluate;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ProductOrderEvaluateMapper {
    List<ProductOrderEvaluate> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM product_order_evaluate WHERE id = #{id}")
    ProductOrderEvaluate selectById(Integer id);

    @Select("SELECT * FROM product_order_evaluate")
    List<ProductOrderEvaluate> list();

    int insert(ProductOrderEvaluate entity);

    int updateById(ProductOrderEvaluate entity);

    boolean removeByIds(List<Integer> ids);

}

 