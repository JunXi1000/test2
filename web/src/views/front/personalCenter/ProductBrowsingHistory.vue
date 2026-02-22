<template>
  <div style="margin-left: 5px">
    <el-space direction="vertical" alignment="left" style="width: 100%">
      <el-row :gutter="20">
        <el-col :span="6" v-for="(item,index) in listData">
          <el-card shadow="hover" :style="index>3 ? { marginTop: '10px',cursor: 'pointer' } : 'cursor: pointer'">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-image style=" width: 100%;height: calc(0.69 * 10vw);" fit="fill"
                          :src="item.productMainImg"
                />
              </el-col>
              <el-col :span="12">
                <el-space direction="vertical">
                  <el-text size="default" tag="b" line-clamp="4">
                    {{ item.productName }}
                  </el-text>
                  <el-text size="small" tag="b" line-clamp="2">
                    {{ item.createTime }}
                  </el-text>
                </el-space>
              </el-col>
            </el-row>
          </el-card>
        </el-col>
      </el-row>
      <el-pagination
          @current-change="currentChange"
          @size-change="sizeChange"
          :page-size="pageInfo.pageSize"
          :current-page="pageInfo.pageNum"
          background
          layout="total,sizes, prev, pager, next"
          :total="pageInfo.total">
      </el-pagination>

    </el-space>
  </div>
</template>

<script setup>
import request from "@/utils/http.js";
import {Check, Close, Delete, Edit, Refresh, Plus, Search} from '@element-plus/icons-vue'
import {ref, toRaw} from "vue";
import {ElMessage, ElMessageBox} from "element-plus";


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
  request.get("/productBrowsingHistory/page", {
    params: pageInfo.value
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
  console.log(e)
}


</script>

<style scoped>

</style>
