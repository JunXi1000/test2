package com.project.platform.mapper;

import com.project.platform.entity.Product;
import com.project.platform.vo.ValueNameVO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ProductMapper {
    List<Product> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM product WHERE id = #{id}")
    Product selectById(Integer id);

    @Select("SELECT * FROM product")
    List<Product> list();

    int insert(Product entity);

    int updateById(Product entity);

    boolean removeByIds(List<Integer> ids);

    @Select("SELECT * FROM product order by sales_volume desc limit #{size}")
    List<Product> salesVolumeTop(int size);

    @Select("select product_type.name  as name,product.count  as value from  product_type  join ( SELECT product_type_id,COUNT(*) AS count FROM product  GROUP BY product_type_id)  product on product.product_type_id=product_type.id")
    List<ValueNameVO> selectTypeCount();

    @Select("select product_type.name  as name,product.count  as value from  product_type  join ( SELECT product_type_id,COUNT(*) AS count FROM product where shop_id= #{shopId}  GROUP BY product_type_id)  product on product.product_type_id=product_type.id")
    List<ValueNameVO> selectTypeCountByShopId(Integer shopId);


}
