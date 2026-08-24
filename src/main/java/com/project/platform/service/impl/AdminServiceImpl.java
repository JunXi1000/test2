package com.project.platform.service.impl;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.RetrievePasswordDTO;
import com.project.platform.dto.UpdatePasswordDTO;
import com.project.platform.entity.Admin;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.AdminMapper;
import com.project.platform.service.AdminService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.utils.PageParams;
import com.project.platform.vo.PageVO;
import jakarta.annotation.Resource;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * <p>
 * 用户信息表 服务实现类
 * </p>
 */
@Service
public class AdminServiceImpl implements AdminService {
    @Resource
    private AdminMapper adminMapper;

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

    @Override
    public PageVO<Admin> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<Admin> page = new PageVO();
        PageParams.Normalized p = PageParams.normalize(pageNum, pageSize);
        List<Admin> list = adminMapper.queryPage(p.offset(), p.pageSize(), query);
        page.setList(list);
        page.setTotal(adminMapper.queryCount(query));
        return page;
    }

    @Override
    public Admin selectById(Integer id) {
        Admin admin = adminMapper.selectById(id);
        return admin;
    }

    @Override
    public List<Admin> list() {
        return adminMapper.list();
    }

    @Override
    public void insert(Admin entity) {
        check(entity);
        if (entity.getPassword() == null) {
            entity.setPassword(resetPassword);
        }
        entity.setPassword(encodeIfNeeded(entity.getPassword()));
        adminMapper.insert(entity);
    }

    @Override
    public void updateById(Admin entity) {
        check(entity);
        entity.setPassword(encodeIfNeeded(entity.getPassword()));
        adminMapper.updateById(entity);
    }

    private void check(Admin entity) {
        Admin admin = adminMapper.selectByUserName(entity.getUsername());
        if (admin != null && !admin.getId().equals(entity.getId())) {
            throw new CustomException("用户名已存在");
        }
    }

    @Override
    public void removeByIds(List<Integer> ids) {
        adminMapper.removeByIds(ids);
    }

    @Override
    public CurrentUserDTO login(String username, String password) {
        Admin admin = adminMapper.selectByUserName(username);
        if (admin == null || !passwordEncoder.matches(password, admin.getPassword())) {
            throw new CustomException("用户名或密码错误");
        }
        if (admin.getStatus().equals("禁用")) {
            throw new CustomException("用户已禁用");
        }
        CurrentUserDTO currentUserDTO = new CurrentUserDTO();
        BeanUtils.copyProperties(admin, currentUserDTO);
        return currentUserDTO;
    }

    @Override
    public void register(JSONObject data) {
        // 双保险:即使绕过 Controller 白名单,也禁止匿名创建管理员
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        if (current == null || !"ADMIN".equals(current.getType())) {
            throw new CustomException(HttpStatus.FORBIDDEN, "禁止匿名创建管理员");
        }
        Admin admin = new Admin();
        admin.setUsername(data.getString("username"));
        admin.setNickname(data.getString("nickname"));
        admin.setAvatarUrl(data.getString("avatarUrl"));
        admin.setPassword(data.getString("password"));
        admin.setStatus("启用");
        insert(admin);
    }


    @Override
    public void updateCurrentUserInfo(CurrentUserDTO currentUserDTO) {
        Admin admin = adminMapper.selectById(currentUserDTO.getId());
        admin.setId(currentUserDTO.getId());
        admin.setNickname(currentUserDTO.getNickname());
        admin.setAvatarUrl(currentUserDTO.getAvatarUrl());
        admin.setTel(currentUserDTO.getTel());
        admin.setEmail(currentUserDTO.getEmail());
        adminMapper.updateById(admin);
    }

    @Override
    public void updateCurrentUserPassword(UpdatePasswordDTO updatePassword) {
        Admin admin = adminMapper.selectById(CurrentUserThreadLocal.getCurrentUser().getId());
        if (!passwordEncoder.matches(updatePassword.getOldPassword(), admin.getPassword())) {
            throw new CustomException("旧密码不正确");
        }
        admin.setPassword(encodeIfNeeded(updatePassword.getNewPassword()));
        adminMapper.updateById(admin);
    }

    @Override
    public void resetPassword(Integer id) {
        Admin admin = adminMapper.selectById(id);
        admin.setPassword(encodeIfNeeded(resetPassword));
        adminMapper.updateById(admin);
    }

    @Override
    public void retrievePassword(RetrievePasswordDTO retrievePasswordDTO) {
        // 先校验验证码(不存在/过期/不匹配均拒绝),杜绝仅凭手机号改密
        if (!resetCodeStore.verify(retrievePasswordDTO.getType(), retrievePasswordDTO.getTel(), retrievePasswordDTO.getCode())) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "验证码无效或已过期");
        }
        Admin admin = adminMapper.selectByTel(retrievePasswordDTO.getTel());
        if (admin == null) {
            throw new CustomException("手机号不存在");
        }
        admin.setPassword(encodeIfNeeded(retrievePasswordDTO.getPassword()));
        adminMapper.updateById(admin);
    }


}
