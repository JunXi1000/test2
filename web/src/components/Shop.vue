<template>
  <el-space size="large"    @click="router.push('/productList?shopId='+shop.id)">
    <el-image style=" width: 80px;height: 80px;" fit="fill"
              :src="shop.avatarUrl"
    />
    <el-space direction="vertical" alignment="left">
      <el-space>
        <H3>
          {{ shop.name }}
        </H3>
        <el-tag type="success">官方</el-tag>

      </el-space>
      <el-space>
        <span>{{ shop.fansCount }}</span>
        <span>人关注</span>
        <div style="float: right">
          <el-button size="small" link type="info" @click.stop="removeShopCollect" v-if="shop.shopCollectId">取消关注
          </el-button>
          <el-button size="small" link type="warning" @click.stop="addShopCollect" v-if="!shop.shopCollectId">关注
          </el-button>
        </div>
      </el-space>

    </el-space>
    <el-button>进店</el-button>
  </el-space>
</template>
<script setup>
import {defineProps, ref} from "vue";
import request from "@/utils/http.js";
import router from "@/router/index.js";

const props = defineProps({
  shopId: {
    type: Number,
    default: 0,
  }
});

const shop = ref({})
getShop();

function getShop() {
  request.get("/shop/selectById/" + props.shopId).then(res => {
    shop.value = res.data;
  })
}

function addShopCollect() {
  request.post("/shopCollect/add", {shopId: props.shopId}).then(res => {
    if (!res) {
      return
    }
    getShop();
  })
}


function removeShopCollect() {
  let ids = [
    shop.value.shopCollectId
  ]
  request.delete("/shopCollect/delBatch", {data: ids}).then(res => {
    if (!res) {
      return
    }
    getShop();
  })
}


</script>