package com.project.platform.mapper;

import com.project.platform.entity.ProductCollect;
import com.project.platform.vo.ValueNameVO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ProductCollectMapper {
    List<ProductCollect> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM product_collect WHERE id = #{id}")
    ProductCollect selectById(Integer id);

    @Select("SELECT * FROM product_collect")
    List<ProductCollect> list();

    int insert(ProductCollect entity);

    int updateById(ProductCollect entity);

    boolean removeByIds(List<Integer> ids);

    @Select("SELECT * FROM product_collect WHERE product_id = #{productId} and user_id= #{userId}")
    ProductCollect selectByProductIdAndUserId(Integer productId, Integer userId);

    //TODO 图表
    @Select("select product.product_type_id   as name,count(product.product_type_id)  as value from product_collect" +
            "    left join product on product_collect.product_id=product.id" +
            "    where  product_collect.user_id= #{userId}" +
            "    group by product.product_type_id")
    List<ValueNameVO> statisticsProductTypeIdByUserId(Integer userId);

}
