package com.project.platform.mapper;

import com.project.platform.entity.Product;
import com.project.platform.vo.ValueNameVO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

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

    /**
     * 原子扣减库存(乐观锁:stock >= qty 才扣),受影响行数为 0 表示库存不足。
     */
    @Update("UPDATE product SET stock = stock - #{qty}, sales_volume = sales_volume + #{qty} WHERE id = #{id} AND stock >= #{qty}")
    int deductStock(@Param("id") Integer id, @Param("qty") Integer qty);

    /**
     * 原子回补库存(取消/退款场景),sales_volume 不回补为负。
     */
    @Update("UPDATE product SET stock = stock + #{qty}, sales_volume = GREATEST(sales_volume - #{qty}, 0) WHERE id = #{id}")
    int restoreStock(@Param("id") Integer id, @Param("qty") Integer qty);


}
