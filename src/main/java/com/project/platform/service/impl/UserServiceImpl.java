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
import java.util.regex.Pattern;

@Service
public class UserServiceImpl implements UserService {

    /** 与前端 web/src/utils/validators.ts 一致的邮箱格式(注册校验用) */
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @Resource
    private UserMapper userMapper;

    @Value("${resetPassword}")
    private String resetPassword;

    @Resource
    private PasswordEncoder passwordEncoder;

    @Resource
    private ResetCodeStore resetCodeStore;

    /**
     * 密码编码(局部更新用):null 保持 null;$2 开头(BCrypt)视为已编码原样返回,其余编码。
     * 仅用于 updateById —— 该路径的实体往往已从 DB 加载出 BCrypt 哈希,不能重复编码。
     * 面向「设置新密码」的方法(注册/改密/找回/重置)一律直接 passwordEncoder.encode,不做此跳过。
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
        // insert 收到的永远是「新密码」(注册/管理员新建),一律编码;
        // 不跳过 $2 前缀,避免用户把 BCrypt 形态的字符串当密码注册后存储原文导致无法登录。
        entity.setPassword(passwordEncoder.encode(entity.getPassword()));
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
        // trim 用户名:前端登录前同样会 trim,防首尾空格导致与注册值不一致而登录失败
        User user = userMapper.selectByUsername(username == null ? null : username.trim());
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
     * 注册(仅普通用户,SHOP/ADMIN 已在 Controller 拒绝)。
     * 服务端二次校验必填/格式/长度,避免绕过前端直接 POST 脏数据:
     * 空白用户名、弱密码、非法邮箱、超长字段会导致入库脏数据或 DB 列宽溢出报错。
     */
    @Override
    public void register(JSONObject data) {
        String username = data.getString("username");
        String password = data.getString("password");
        String nickname = data.getString("nickname");
        String email = data.getString("email");

        if (username == null || username.trim().isEmpty()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "用户名不能为空");
        }
        if (username.trim().length() > 50) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "用户名过长");
        }
        if (password == null || password.length() < 6) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "密码长度不能少于 6 位");
        }
        if (password.length() > 72) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "密码过长");
        }
        if (email == null || !EMAIL_PATTERN.matcher(email.trim()).matches()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "邮箱格式不正确");
        }

        User user = new User();
        // trim 用户名:前端登录前同样会 trim,保证注册/登录一致,避免首尾空格导致登录不上
        user.setUsername(username.trim());
        user.setPassword(password);
        user.setNickname(nickname);
        user.setAvatarUrl(data.getString("avatarUrl"));
        // 注册时邮箱必须同时落 email 列(前端把邮箱既当 username 又作为 email 字段传入),
        // 否则管理端用户列表 email 为空(登录用 username,这里两者一致)。
        user.setEmail(email.trim());
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
        // 仅允许修改自己的信息:以当前登录用户的 id 为准,忽略请求体中的 id,
        // 防止水平越权(登录用户提交他人 id 篡改对方昵称/头像/手机/邮箱)。
        Integer currentId = CurrentUserThreadLocal.getCurrentUser().getId();
        User user = userMapper.selectById(currentId);
        if (user == null) {
            throw new CustomException("用户不存在");
        }
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
        // 新密码为用户新输入的明文,一律重新编码(不做 $2 前缀跳过)
        user.setPassword(passwordEncoder.encode(updatePassword.getNewPassword()));
        userMapper.updateById(user);
    }

    /**
     * 重置密码
     * @param id
     */
    @Override
    public void resetPassword(Integer id) {
        User user = userMapper.selectById(id);
        // 后台重置到默认密码(明文配置),一律重新编码
        user.setPassword(passwordEncoder.encode(resetPassword));
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

        // 新密码为用户新输入的明文,一律重新编码
        user.setPassword(passwordEncoder.encode(retrievePasswordDTO.getPassword()));
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
