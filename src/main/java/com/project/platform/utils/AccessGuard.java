package com.project.platform.utils;

import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.entity.ProductOrder;
import com.project.platform.exception.CustomException;
import org.springframework.http.HttpStatus;

/**
 * 归属校验工具:防止横向越权(普通用户操作他人的数据、商家操作其他店铺的数据)。
 * 规则:ADMIN 全通过;USER 只能操作 userId 属于自己的资源;SHOP 只能操作 shopId 属于自己的资源。
 */
public final class AccessGuard {

    private AccessGuard() {
    }

    /**
     * 校验订单归属(USER 比对 userId,SHOP 比对 shopId,ADMIN 放行)。
     */
    public static void checkOrderOwner(ProductOrder order, CurrentUserDTO current) {
        if (order == null) {
            throw new CustomException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        String type = current.getType();
        if ("ADMIN".equals(type)) {
            return;
        }
        if ("USER".equals(type)) {
            if (order.getUserId() == null || !order.getUserId().equals(current.getId())) {
                throw new CustomException(HttpStatus.FORBIDDEN, "无权操作该订单");
            }
            return;
        }
        if ("SHOP".equals(type)) {
            if (order.getShopId() == null || !order.getShopId().equals(current.getId())) {
                throw new CustomException(HttpStatus.FORBIDDEN, "无权操作该订单");
            }
            return;
        }
        throw new CustomException(HttpStatus.FORBIDDEN, "无权操作该订单");
    }

    /**
     * 校验资源归属:ownerId(资源所属用户/店铺 id)必须与当前登录用户 id 一致(ADMIN 除外)。
     *
     * @param ownerId       资源所属的用户 id 或店铺 id
     * @param current       当前登录用户
     * @param resourceDesc  资源描述,用于错误提示(如"商品"、"地址")
     */
    public static void checkOwner(Integer ownerId, CurrentUserDTO current, String resourceDesc) {
        if (current == null) {
            throw new CustomException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        if ("ADMIN".equals(current.getType())) {
            return;
        }
        if (ownerId == null || !ownerId.equals(current.getId())) {
            throw new CustomException(HttpStatus.FORBIDDEN, "无权操作该" + resourceDesc);
        }
    }
}
