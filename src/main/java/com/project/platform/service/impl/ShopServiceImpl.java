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
import jakarta.annotation.Resource;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
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

    @Override
    public PageVO<Shop> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<Shop> page = new PageVO();
        List<Shop> list = shopMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
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
        entity.setFansCount(0);//设置初始粉丝为0
        shopMapper.insert(entity);
    }
    @Override
    public void updateById(Shop entity) {
        check(entity);
        shopMapper.updateById(entity);
    }
    private void check(Shop entity) {
        Shop shop = shopMapper.selectByUsername(entity.getUsername());
        if (shop != null && shop.getId() != entity.getId()) {
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
        if (shop == null || !shop.getPassword().equals(password)) {
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
        if (!shop.getPassword().equals(updatePassword.getOldPassword())) {
            throw new CustomException("旧密码不正确");
        }
        shop.setPassword(updatePassword.getNewPassword());
        shopMapper.updateById(shop);
    }

    @Override
    public void resetPassword(Integer id) {
        Shop shop = shopMapper.selectById(id);
        shop.setPassword(resetPassword);
        shopMapper.updateById(shop);
    }

    @Override
    public void retrievePassword(RetrievePasswordDTO retrievePasswordDTO) {
        Shop shop = shopMapper.selectByTel(retrievePasswordDTO.getTel());
        if (shop == null) {
            throw new CustomException("手机号不存在");
        }
        //TODO 校验验证码
        shop.setPassword(retrievePasswordDTO.getPassword());
        shopMapper.updateById(shop);
    }
}
