package com.project.platform.mapper;

import com.project.platform.entity.ProductCollect;
import com.project.platform.entity.ShoppingCart;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;


public interface ShoppingCartMapper {
    List<ShoppingCart> queryPage(Integer offset, Integer pageSize, @Param("query") Map<String, Object> query);

    int queryCount(@Param("query") Map<String, Object> query);

    @Select("SELECT * FROM shopping_cart WHERE id = #{id}")
    ShoppingCart selectById(Integer id);

    @Select("SELECT * FROM shopping_cart")
    List<ShoppingCart> list();

    int insert(ShoppingCart entity);

    int updateById(ShoppingCart entity);

    boolean removeByIds(List<Integer> ids);

    @Select("SELECT * FROM shopping_cart WHERE product_id = #{productId} and user_id= #{userId}")
    ShoppingCart selectByProductIdAndUserId(Integer productId, Integer userId);
    @Select("DELETE FROM shopping_cart WHERE user_id= #{userId}")
    boolean removeByUserId( Integer userId);

    /**
     * 删除当前用户的购物车行(防御横向越权:仅能删自己的行)。
     */
    @Delete("<script>DELETE FROM shopping_cart WHERE user_id = #{userId} AND id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>")
    int removeByIdsOfUser(@Param("userId") Integer userId, @Param("ids") List<Integer> ids);


}
