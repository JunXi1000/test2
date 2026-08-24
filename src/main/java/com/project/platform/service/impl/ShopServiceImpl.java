package com.project.platform.service.impl;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.RetrievePasswordDTO;
import com.project.platform.dto.UpdatePasswordDTO;
import com.project.platform.entity.Shop;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ShopMapper;
import com.project.platform.service.ShopService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.utils.PageParams;
import jakarta.annotation.Resource;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.List;
import java.util.Map;
/**
 * 店铺
 */
@Service
public class ShopServiceImpl  implements ShopService {
    @Resource
    private ShopMapper shopMapper;
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
    public PageVO<Shop> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<Shop> page = new PageVO();
        PageParams.Normalized p = PageParams.normalize(pageNum, pageSize);
        List<Shop> list = shopMapper.queryPage(p.offset(), p.pageSize(), query);
        page.setList(list);
        page.setTotal(shopMapper.queryCount(query));
        return page;
    }

    @Override
    public Shop selectById(Integer id) {
        Shop shop = shopMapper.selectById(id);
        return shop;
    }

    @Override
    public List<Shop> list() {
        return shopMapper.list();
    }
    @Override
    public void insert(Shop entity) {
        check(entity);
        if (entity.getPassword() == null) {
            entity.setPassword(resetPassword);
        }
        entity.setPassword(encodeIfNeeded(entity.getPassword()));
        entity.setFansCount(0);//设置初始粉丝为0
        shopMapper.insert(entity);
    }
    @Override
    public void updateById(Shop entity) {
        check(entity);
        entity.setPassword(encodeIfNeeded(entity.getPassword()));
        shopMapper.updateById(entity);
    }
    private void check(Shop entity) {
        Shop shop = shopMapper.selectByUsername(entity.getUsername());
        if (shop != null && !shop.getId().equals(entity.getId())) {
            throw new CustomException("用户名已存在");
        }
    }

    @Override
    public void removeByIds(List<Integer> ids) {
        shopMapper.removeByIds(ids);
    }


    @Override
    public CurrentUserDTO login(String username, String password) {
        Shop shop = shopMapper.selectByUsername(username);
        if (shop == null || !passwordEncoder.matches(password, shop.getPassword())) {
            throw new CustomException("用户名或密码错误");
        }
        if (shop.getStatus().equals("禁用")) {
            throw new CustomException("用户已禁用，新注册的用户请等待管理员审核启用");
        }
        CurrentUserDTO currentShopDTO = new CurrentUserDTO();
        BeanUtils.copyProperties(shop, currentShopDTO);
        return currentShopDTO;
    }

    @Override
    public void register(JSONObject data) {
        Shop shop = new Shop();
        shop.setUsername(data.getString("username"));
        shop.setNickname(data.getString("nickname"));
        shop.setAvatarUrl(data.getString("avatarUrl"));
        shop.setPassword(data.getString("password"));
        shop.setAptitudeImgs(data.getString("aptitudeImgs"));
        shop.setName(data.getString("name"));
        shop.setStatus("禁用");//默认禁用，需要管理员审核
        insert(shop);
    }


    @Override
    public void updateCurrentUserInfo(CurrentUserDTO currentShopDTO) {
        Shop shop = shopMapper.selectById(currentShopDTO.getId());
        shop.setId(currentShopDTO.getId());
        shop.setNickname(currentShopDTO.getNickname());
        shop.setAvatarUrl(currentShopDTO.getAvatarUrl());
        shop.setTel(currentShopDTO.getTel());
        shop.setEmail(currentShopDTO.getEmail());
        shopMapper.updateById(shop);
    }

    @Override
    public void updateCurrentUserPassword(UpdatePasswordDTO updatePassword) {
        Shop shop = shopMapper.selectById(CurrentUserThreadLocal.getCurrentUser().getId());
        if (!passwordEncoder.matches(updatePassword.getOldPassword(), shop.getPassword())) {
            throw new CustomException("旧密码不正确");
        }
        shop.setPassword(encodeIfNeeded(updatePassword.getNewPassword()));
        shopMapper.updateById(shop);
    }

    @Override
    public void resetPassword(Integer id) {
        Shop shop = shopMapper.selectById(id);
        shop.setPassword(encodeIfNeeded(resetPassword));
        shopMapper.updateById(shop);
    }

    @Override
    public void retrievePassword(RetrievePasswordDTO retrievePasswordDTO) {
        // 先校验验证码(不存在/过期/不匹配均拒绝),杜绝仅凭手机号改密
        if (!resetCodeStore.verify(retrievePasswordDTO.getType(), retrievePasswordDTO.getTel(), retrievePasswordDTO.getCode())) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "验证码无效或已过期");
        }
        Shop shop = shopMapper.selectByTel(retrievePasswordDTO.getTel());
        if (shop == null) {
            throw new CustomException("手机号不存在");
        }
        shop.setPassword(encodeIfNeeded(retrievePasswordDTO.getPassword()));
        shopMapper.updateById(shop);
    }
}
