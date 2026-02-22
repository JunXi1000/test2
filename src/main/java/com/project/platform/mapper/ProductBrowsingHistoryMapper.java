package com.project.platform.mapper;

import com.project.platform.entity.ProductBrowsingHistory;
import com.project.platform.entity.ProductCollect;
import com.project.platform.vo.ValueNameVO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ProductBrowsingHistoryMapper {
    List<ProductBrowsingHistory> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM product_browsing_history WHERE id = #{id}")
    ProductBrowsingHistory selectById(Integer id);

    @Select("SELECT * FROM product_browsing_history")
    List<ProductBrowsingHistory> list();

    int insert(ProductBrowsingHistory entity);

    int updateById(ProductBrowsingHistory entity);

    boolean removeByIds(List<Integer> ids);

    @Select("SELECT * FROM product_browsing_history WHERE product_id = #{productId} and user_id= #{userId}")
    ProductBrowsingHistory selectByProductIdAndUserId(Integer productId, Integer userId);

    @Select("select product.product_type_id  as name,count(product.product_type_id)  as value from product_browsing_history" +
            "    left join product on product_browsing_history.product_id=product.id" +
            "    where  product_browsing_history.user_id= #{userId}" +
            "    group by product.product_type_id")
    List<ValueNameVO> statisticsProductTypeIdByUserId(Integer userId);
}
