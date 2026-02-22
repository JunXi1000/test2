<template>
  <div>
    <el-space direction="vertical" alignment="left" style="width: 100%" v-if="listData.length>0">
      <div v-for="item in listData" :key="item.id">
        <el-card shadow="always">
          <el-space direction="vertical" alignment="left" size="large" style="width: 100%">
            <div>
              <el-space style="max-width: 500px">
                <el-avatar
                    :src="item.userAvatar"
                />
                <span>{{ item.username }}</span>
              </el-space>
            </div>
            <el-rate
                v-model="item.rate"
                disabled
                show-score
                text-color="#ff9900"
                score-template="{value} 分"
            />
            <span>{{ item.content }}</span>
            <div style="text-align: right">
                  <span style="font-size: 14px;">
                    {{ item.createTime }}
                  </span>
            </div>
          </el-space>
        </el-card>
      </div>
      <div>
        <el-pagination
            @current-change="currentChange"
            @size-change="sizeChange"
            :page-size="pageInfo.pageSize"
            :current-page="pageInfo.pageNum"
            layout=" prev, pager, next"
            :total="pageInfo.total">
        </el-pagination>
      </div>
    </el-space>
    <el-empty v-else description="暂无评价"/>
  </div>

</template>
<script setup>

import {defineProps, ref, toRaw} from "vue";
import request from "@/utils/http.js";

const props = defineProps({
  productId: {
    type: Number,
    default: 0,
  }
});
const listData = ref([]);
const pageInfo = ref({
  //当前页
  pageNum: 1,
  //分页大小
  pageSize: 10,
  //总条数
  total: 0
});


getPageList()

/**
 * 获取分页数据
 */
function getPageList() {
  let data = pageInfo.value
  data.productId = props.productId
  request.get("/productOrderEvaluate/page", {
    params: data
  }).then(res => {
    listData.value = res.data.list
    pageInfo.value.total = res.data.total
  })
}

/**
 * 选择分页
 * @param e
 */
function currentChange(e) {
  pageInfo.value.pageNum = e
  getPageList()
}

/**
 * 改变分页数量
 * @param e
 */
function sizeChange(e) {
  pageInfo.value.pageSize = e
  getPageList()
}
</script>

<style scoped>
.el-card {
  --el-card-padding: 15px;
}
</style>
