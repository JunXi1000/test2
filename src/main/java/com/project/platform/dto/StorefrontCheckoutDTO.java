package com.project.platform.dto;

import java.util.List;

/**
 * 前台结算下单请求(Phase 2)。
 * items 直接以商品 id + 数量描述(兼容结算页传整条 CartItem:price 等字段忽略,
 * 金额一律以 DB 价格为准);cartItemIds 为下单成功后待清除的购物车行 id(可选)。
 */
public class StorefrontCheckoutDTO {

    private List<Item> items;
    private Shipping shipping;
    private String remark;
    /** 支付渠道:card=模拟银行卡 / balance=钱包余额 */
    private String channel;
    /** 下单成功后要清除的购物车行 id(服务端按当前用户过滤,防御横向越权) */
    private List<Integer> cartItemIds;

    public static class Item {
        private Integer productId;
        private Integer id;
        private Integer quantity;

        /** 兼容前端 CartItem.id:productId 优先,缺省回落 id */
        public Integer resolveProductId() {
            return productId != null ? productId : id;
        }

        public Integer getProductId() {
            return productId;
        }

        public void setProductId(Integer productId) {
            this.productId = productId;
        }

        public Integer getId() {
            return id;
        }

        public void setId(Integer id) {
            this.id = id;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }
    }

    public static class Shipping {
        private String name;
        private String tel;
        private String address;
        private String city;
        private String zip;
        private String country;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getTel() {
            return tel;
        }

        public void setTel(String tel) {
            this.tel = tel;
        }

        public String getAddress() {
            return address;
        }

        public void setAddress(String address) {
            this.address = address;
        }

        public String getCity() {
            return city;
        }

        public void setCity(String city) {
            this.city = city;
        }

        public String getZip() {
            return zip;
        }

        public void setZip(String zip) {
            this.zip = zip;
        }

        public String getCountry() {
            return country;
        }

        public void setCountry(String country) {
            this.country = country;
        }
    }

    public List<Item> getItems() {
        return items;
    }

    public void setItems(List<Item> items) {
        this.items = items;
    }

    public Shipping getShipping() {
        return shipping;
    }

    public void setShipping(Shipping shipping) {
        this.shipping = shipping;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public List<Integer> getCartItemIds() {
        return cartItemIds;
    }

    public void setCartItemIds(List<Integer> cartItemIds) {
        this.cartItemIds = cartItemIds;
    }
}
