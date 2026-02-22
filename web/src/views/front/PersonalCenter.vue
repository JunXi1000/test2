<template>
  <div style="width: 75%;margin: 0 auto" :key="activeName">
    <el-card>
      <el-tabs v-model="activeName" tab-position="left">
        <el-tab-pane label="收货地址" name="shippingAddress">
          <ShippingAddress v-if="activeName==='shippingAddress'"></ShippingAddress>
        </el-tab-pane>

        <el-tab-pane label="商品收藏" name="productCollect">
          <ProductCollect v-if="activeName==='productCollect'"></ProductCollect>
        </el-tab-pane>

        <el-tab-pane label="商品浏览历史" name="productBrowsingHistory">
          <productBrowsingHistory v-if="activeName==='productBrowsingHistory'"></productBrowsingHistory>
        </el-tab-pane>

        <el-tab-pane label="关注店铺" name="shopCollect">
          <shopCollect v-if="activeName==='shopCollect'"></shopCollect>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import {ref} from "vue";
import {useRoute} from "vue-router";
import ShippingAddress from "@/views/front/personalCenter/ShippingAddress.vue";
import ProductCollect from "@/views/front/personalCenter/ProductCollect.vue";
import ProductBrowsingHistory from "@/views/front/personalCenter/ProductBrowsingHistory.vue";
import ShopCollect from "@/views/front/personalCenter/ShopCollect.vue";

const activeName = ref('shippingAddress')
const route = useRoute()
if (route.query.type) {
  activeName.value = route.query.type
}
</script>

<style>

</style>
