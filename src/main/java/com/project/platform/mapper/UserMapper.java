package com.project.platform.mapper;

import com.project.platform.entity.User;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;

import java.util.List;
import java.util.Map;

public interface UserMapper {

    /**
     * 分页模糊查询
     * @param offset
     * @param pageSize
     * @param query
     * @return
     */
    List<User> queryPage(@Param("offset") Integer offset,@Param("pageSize") Integer pageSize,@Param("query") Map<String,Object> query);

    /**
     * 查询总数
     * @param query
     * @return
     */
    int queryCount(@Param("query") Map<String,Object> query);

    /**
     * 查询全部
     * @return
     */
    @Select("SELECT * FROM user")
    List<User> list();

    /**
     * 根据用户名查询
     * @param username
     * @return
     */
    @Select("SELECT * FROM user WHERE username = #{username}")
//    @Select("SELECT * FROM user WHERE username LIKE CONCAT('%',#{username},'%')")
    User selectByUsername(String username);

    /**
     * 根据用id查询
     * @param id
     * @return
     */
    @Select("SELECT * FROM user WHERE id = #{id}")
    User selectById(Integer id);

    /**
     * 根据手机号或邮箱查询(仅找回密码使用):
     * 前端找回密码按「邮箱」发送验证码,但既有用户可能是手机号注册(仅 tel 列有值)
     * 或邮箱注册(仅 email 列有值),故两列同时匹配,保证任一注册方式都能找回。
     * @param tel
     * @return
     */
    @Select("SELECT * FROM user WHERE tel = #{tel} OR email = #{tel}")
    User selectByTel(String tel);

    /**
     * 新增
     * @param user
     * @return
     */
    int insert(User user);

    /**
     * 编辑
     * @param entity
     * @return
     */
    int updateById(User entity);

    /**
     * 删除
     * @param ids
     * @return
     */
    boolean removeByIds(List<Integer> ids);

    /**
     * 原子回补余额(退款/充值场景)。
     */
    @Update("UPDATE user SET balance = balance + #{amount} WHERE id = #{id}")
    int addBalance(@Param("id") Integer id, @Param("amount") BigDecimal amount);

    /**
     * 原子扣减余额(乐观锁:balance >= amount 才扣,防并发双花),受影响行数为 0 表示余额不足。
     */
    @Update("UPDATE user SET balance = balance - #{amount} WHERE id = #{id} AND balance >= #{amount}")
    int deductBalance(@Param("id") Integer id, @Param("amount") BigDecimal amount);
}
