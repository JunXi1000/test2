package com.project.platform.service.impl;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.RetrievePasswordDTO;
import com.project.platform.dto.UpdatePasswordDTO;
import com.project.platform.entity.User;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.UserMapper;
import com.project.platform.service.UserService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import jakarta.annotation.Resource;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class UserServiceImpl implements UserService {

    @Resource
    private UserMapper userMapper;

    @Value("${resetPassword}")
    private String resetPassword;

    /**
     * 分页模糊查询
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @Override
    public PageVO<User> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<User> page = new PageVO<>();
        //获取列表数据
        List<User> list = userMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        //获取分页总数
        page.setTotal(userMapper.queryCount(query));
        return page;
    }

    /**
     * 列表返回
     * @return
     */
    @Override
    public List<User> list() {
        return userMapper.list();
    }

    /**
     * 通过用户名查询
     * @param username
     */
    @Override
    public User selectByUsername(String username) {
        return userMapper.selectByUsername(username);
    }

    /**
     * 新增
     * @param entity
     * @return
     */
    @Override
    public void insert(User entity) {
        check(entity);
        entity.setBalance(0.0f);
        entity.setCreateTime(LocalDateTime.now());
        //没有密码则将密码设置已配置的密码
        if (entity.getPassword() == null) {
            entity.setPassword(resetPassword);
        }
        userMapper.insert(entity);
    }


    /**
     * 编辑
     * @param entity
     * @return
     */
    @Override
    public void updateById(User entity) {
        check(entity);
        userMapper.updateById(entity);
    }

    /**
     * 删除
     * @param ids
     */
    @Override
    public void removeByIds(List<Integer> ids) {
        userMapper.removeByIds(ids);
    }

    /**
     * 登录
     * @param username
     * @param password
     * @return
     */
    @Override
    public CurrentUserDTO login(String username, String password) {
        User user = userMapper.selectByUsername(username);
        if (user == null || !user.getPassword().equals(password)) {
            throw new CustomException("用户名或密码错误");
        }
        if("禁用“".equals(user.getStatus())) {
            throw new CustomException("用户已禁用");
        }
        CurrentUserDTO currentUserDTO = new CurrentUserDTO();
        BeanUtils.copyProperties(user, currentUserDTO);
        return currentUserDTO;
    }

    /**
     * 注册
     * @param data
     */
    @Override
    public void register(JSONObject data) {
        User user = new User();
        user.setUsername(data.getString("username"));
        user.setPassword(data.getString("password"));
        user.setNickname(data.getString("nickname"));
        user.setAvatarUrl(data.getString("avatarUrl"));
        //设置时间
        user.setCreateTime(LocalDateTime.now());
        //设置用户状态
        user.setStatus("启用");
        insert(user);
    }

    /**
     * 更新当前用户信息
     * @param currentUserDTO
     */
    @Override
    public void updateCurrentUserInfo(CurrentUserDTO currentUserDTO) {
        User user = userMapper.selectById(currentUserDTO.getId());
        user.setId(currentUserDTO.getId());
        user.setNickname(currentUserDTO.getNickname());
        user.setAvatarUrl(currentUserDTO.getAvatarUrl());
        user.setTel(currentUserDTO.getTel());
        user.setEmail(currentUserDTO.getEmail());
        userMapper.updateById(user);
    }

    /**
     * 修改当前用户密码
     * @param updatePassword
     */
    @Override
    public void updateCurrentUserPassword(UpdatePasswordDTO updatePassword) {
        //用户自己修改
        User user = userMapper.selectById(CurrentUserThreadLocal.getCurrentUser().getId());
        if (!user.getPassword().equals(updatePassword.getOldPassword())){
            throw new CustomException("旧密码不正确");
        }
        user.setPassword(updatePassword.getNewPassword());
        userMapper.updateById(user);
    }

    /**
     * 重置密码
     * @param id
     */
    @Override
    public void resetPassword(Integer id) {
        User user = userMapper.selectById(id);
        user.setPassword(resetPassword);
        userMapper.updateById(user);
    }

    /**
     * 忘记密码
     * @param retrievePasswordDTO
     */
    @Override
    public void retrievePassword(RetrievePasswordDTO retrievePasswordDTO) {
        //忘记密码，通过手机号找回
        User user = userMapper.selectByTel(retrievePasswordDTO.getTel());
        if(user == null) {
            throw  new CustomException("手机号不存在");
        }

        user.setPassword(retrievePasswordDTO.getPassword());
        userMapper.updateById(user);
    }

    /**
     * 查询当前用户信息
     * @param id
     * @return
     */
    @Override
    public User selectById(Integer id) {
        return userMapper.selectById(id);
    }

    private void check(User entity) {
        User byUsername = userMapper.selectByUsername(entity.getUsername());
        if (byUsername != null && entity.getId() != entity.getId()) {
            throw new CustomException("用户名已存在");
        }
    }

    /**
     * 充值
     *
     * @param userId
     * @param amount
     */

    public void topUp(Integer userId, Float amount) {
        User user = selectById(userId);
        user.setBalance(user.getBalance() + amount);
        userMapper.updateById(user);
    }

    /**
     * 消费
     *
     * @param userId
     * @param amount
     */
    public void consumption(Integer userId, Float amount) {
        User user = selectById(userId);
        user.setBalance(user.getBalance() - amount);
        if (user.getBalance() < 0) {
            throw new CustomException("余额不足");
        }
        userMapper.updateById(user);
    }


}
