package com.project.platform.service.impl;

import com.project.platform.dto.CreateOrderByShoppingCartDTO;
import com.project.platform.entity.Product;
import com.project.platform.entity.ProductOrder;
import com.project.platform.entity.ShoppingCart;
import com.project.platform.exception.CustomException;
import com.project.platform.mapper.ProductMapper;
import com.project.platform.mapper.ShoppingCartMapper;
import com.project.platform.service.ProductOrderService;
import com.project.platform.service.ProductService;
import com.project.platform.service.ShoppingCartService;
import com.project.platform.utils.CurrentUserThreadLocal;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import com.project.platform.vo.PageVO;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 购物车
 */
@Service
public class ShoppingCartServiceImpl implements ShoppingCartService {
    @Resource
    private ShoppingCartMapper shoppingCartMapper;

    @Resource
    private ProductOrderService productOrderService;

    @Resource
    private ProductMapper productMapper;

    @Override
    public PageVO<ShoppingCart> page(Map<String, Object> query, Integer pageNum, Integer pageSize) {
        PageVO<ShoppingCart> page = new PageVO();
        if (CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            query.put("userId", CurrentUserThreadLocal.getCurrentUser().getId());
        }
        List<ShoppingCart> list = shoppingCartMapper.queryPage((pageNum - 1) * pageSize, pageSize, query);
        page.setList(list);
        page.setTotal(shoppingCartMapper.queryCount(query));
        return page;
    }

    @Override
    public ShoppingCart selectById(Integer id) {
        ShoppingCart shoppingCart = shoppingCartMapper.selectById(id);
        return shoppingCart;
    }

    @Override
    public List<ShoppingCart> list() {
        return shoppingCartMapper.list();
    }

    @Override
    public void insert(ShoppingCart entity) {
        if (!CurrentUserThreadLocal.getCurrentUser().getType().equals("USER")) {
            throw new CustomException("普通用户才允许添加商品到购物车");
        }
        entity.setUserId(CurrentUserThreadLocal.getCurrentUser().getId());
        ShoppingCart shoppingCart = shoppingCartMapper.selectByProductIdAndUserId(entity.getProductId(), entity.getUserId());
        if (shoppingCart != null) {
            shoppingCart.setQuantity(shoppingCart.getQuantity() + entity.getQuantity());
            shoppingCartMapper.updateById(shoppingCart);
            return;
        }
        shoppingCartMapper.insert(entity);
    }

    @Override
    public void updateById(ShoppingCart entity) {
        shoppingCartMapper.updateById(entity);
    }


    @Override
    public void removeByIds(List<Integer> ids) {
        shoppingCartMapper.removeByIds(ids);
    }

    @Override
    public void createOrder(CreateOrderByShoppingCartDTO createOrderByShoppingCartDTO) {
        //错误信息
        List<String> errorMessages = new ArrayList<>();
        createOrderByShoppingCartDTO.getIds().forEach(shoppingCartId -> {
            //查询购物车信息
            ShoppingCart shoppingCart = shoppingCartMapper.selectById(shoppingCartId);
            ProductOrder productOrder = new ProductOrder();
            productOrder.setProductId(shoppingCart.getProductId());
            productOrder.setQuantity(shoppingCart.getQuantity());
            productOrder.setConsigneeAddress(createOrderByShoppingCartDTO.getConsigneeAddress());
            productOrder.setConsigneeName(createOrderByShoppingCartDTO.getConsigneeName());
            productOrder.setConsigneeTel(createOrderByShoppingCartDTO.getConsigneeTel());
            productOrder.setRemark(createOrderByShoppingCartDTO.getRemark());
            try {
                productOrderService.insert(productOrder);
                //下单成功删除购物车
                shoppingCartMapper.removeByIds(List.of(shoppingCartId));
            } catch (CustomException e) {
                Product product = productMapper.selectById(shoppingCart.getProductId());
                errorMessages.add(product.getName() + " 下单失败，原因：" + e.getMessage());
            }
        });
        if (errorMessages.isEmpty()) {
            return;
        }

        throw new CustomException(errorMessages.toString());
    }


}

