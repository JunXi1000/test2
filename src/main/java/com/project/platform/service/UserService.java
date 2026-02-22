package com.project.platform.service;

import com.project.platform.entity.User;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;

public interface UserService extends CommonService{

    /**
     * 分页模糊查询
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    PageVO<User> page(Map<String,Object> query,Integer pageNum,Integer pageSize);

    /**
     * 列表返回
     * @return
     */
    List<User> list();

    /**
     * 通过id查询
     * @param id
     * @return
     */
    User selectById(Integer id);

    /**
     * 通过用户名查询
     * @param username
     * @return
     */
    User selectByUsername(String username);

    /**
     * 新增
     * @param user
     */
    void insert(User user);

    /**
     * 编辑
     * @param entity
     */
    void updateById(User entity);

    /**
     * 删除
     * @param ids
     */
    void removeByIds(List<Integer> ids);

    /**
     * 充值
     *
     * @param userId
     * @param amount
     */
    void topUp(Integer userId, Float amount);

    /**
     * 消费
     *
     * @param userId
     * @param amount
     */
    void consumption(Integer userId, Float amount);

}
