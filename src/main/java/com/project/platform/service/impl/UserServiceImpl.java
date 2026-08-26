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
import com.project.platform.utils.PageParams;
import com.project.platform.vo.PageVO;
import jakarta.annotation.Resource;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class UserServiceImpl implements UserService {

    @Resource
    private UserMapper userMapper;

    @Value("${resetPassword}")
    private String resetPassword;

    @Resource
    private PasswordEncoder passwordEncoder;

    @Resource
    private ResetCodeStore resetCodeStore;

    /**
     * 密码统一编码入口:null 保持 null;$2 开头(BCrypt)视为已编码原样返回,其余编码。
     * 防止 updateById 局部更新时对已哈希密码重复编码。
     */
    private String encodeIfNeeded(String raw) {
        if (raw == null || raw.startsWith("$2")) {
            return raw;
        }
        return passwordEncoder.encode(raw);
    }

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
        PageParams.Normalized p = PageParams.normalize(pageNum, pageSize);
        List<User> list = userMapper.queryPage(p.offset(), p.pageSize(), query);
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
        entity.setBalance(BigDecimal.ZERO);
        entity.setCreateTime(LocalDateTime.now());
        //没有密码则将密码设置已配置的密码
        if (entity.getPassword() == null) {
            entity.setPassword(resetPassword);
        }
        entity.setPassword(encodeIfNeeded(entity.getPassword()));
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
        entity.setPassword(encodeIfNeeded(entity.getPassword()));
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
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new CustomException("用户名或密码错误");
        }
        if ("禁用".equals(user.getStatus())) {
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
        // 注册时邮箱必须同时落 email 列(前端把邮箱既当 username 又作为 email 字段传入),
        // 否则管理端用户列表 email 为空(登录用 username,这里两者一致)。
        user.setEmail(data.getString("email"));
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
        if (!passwordEncoder.matches(updatePassword.getOldPassword(), user.getPassword())){
            throw new CustomException("旧密码不正确");
        }
        user.setPassword(encodeIfNeeded(updatePassword.getNewPassword()));
        userMapper.updateById(user);
    }

    /**
     * 重置密码
     * @param id
     */
    @Override
    public void resetPassword(Integer id) {
        User user = userMapper.selectById(id);
        user.setPassword(encodeIfNeeded(resetPassword));
        userMapper.updateById(user);
    }

    /**
     * 忘记密码
     * @param retrievePasswordDTO
     */
    @Override
    public void retrievePassword(RetrievePasswordDTO retrievePasswordDTO) {
        // 先校验验证码(不存在/过期/不匹配均拒绝),杜绝仅凭手机号改密
        if (!resetCodeStore.verify(retrievePasswordDTO.getType(), retrievePasswordDTO.getTel(), retrievePasswordDTO.getCode())) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "验证码无效或已过期");
        }
        //忘记密码，通过手机号找回
        User user = userMapper.selectByTel(retrievePasswordDTO.getTel());
        if(user == null) {
            throw  new CustomException("手机号不存在");
        }

        user.setPassword(encodeIfNeeded(retrievePasswordDTO.getPassword()));
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
        if (byUsername != null && !byUsername.getId().equals(entity.getId())) {
            throw new CustomException("用户名已存在");
        }
    }

    /**
     * 充值
     *
     * @param userId
     * @param amount
     */

    @Transactional(rollbackFor = Exception.class)
    public void topUp(Integer userId, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new CustomException("充值金额必须大于0");
        }
        // 原子回补余额(退款/充值场景)
        int rows = userMapper.addBalance(userId, amount);
        if (rows == 0) {
            throw new CustomException("用户不存在");
        }
    }

    /**
     * 消费
     *
     * @param userId
     * @param amount
     */
    @Transactional(rollbackFor = Exception.class)
    public void consumption(Integer userId, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new CustomException("消费金额必须大于0");
        }
        // 原子扣减余额(乐观锁:balance>=amount 才扣,防并发双花)
        int rows = userMapper.deductBalance(userId, amount);
        if (rows == 0) {
            throw new CustomException("余额不足");
        }
    }


}
