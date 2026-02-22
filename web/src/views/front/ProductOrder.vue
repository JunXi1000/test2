<template>
  <div style="width: 75%;margin: 0 auto">
    <el-card>
      <el-tabs v-model="searchForm.status" @tab-change="getPageList">
        <el-tab-pane label="全部" name=""></el-tab-pane>
        <el-tab-pane label="待支付" name="待支付"></el-tab-pane>
        <el-tab-pane label="待发货" name="待发货"></el-tab-pane>
        <el-tab-pane label="待收货" name="待收货"></el-tab-pane>
        <el-tab-pane label="已完成" name="已完成"></el-tab-pane>
        <el-tab-pane label="已取消" name="已取消"></el-tab-pane>
      </el-tabs>
      <el-space direction="vertical" alignment="left" style="width: 100%">
        <el-table ref="tableComponents"
                  :data="listData"
                  tooltip-effect="dark"
                  style="width: 100%"
                  border>
          <el-table-column prop="id" label="ID" width="50"></el-table-column>
          <el-table-column prop="productName" label="商品名称"></el-table-column>
          <el-table-column prop="shopName" label="店铺名称 "></el-table-column>
          <el-table-column prop="quantity" label="数量"></el-table-column>
          <el-table-column prop="totalMoney" label="总金额" width="80"></el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <el-tag v-if="scope.row.status==='待支付'" type="warning">{{ scope.row.status }}</el-tag>
              <el-tag v-else-if="scope.row.status==='待发货'" type="info">{{ scope.row.status }}</el-tag>
              <el-tag v-else-if="scope.row.status==='待收货'" type="primary">{{ scope.row.status }}</el-tag>
              <el-tag v-else-if="scope.row.status==='已完成'" type="success">{{ scope.row.status }}</el-tag>
              <el-tag v-else-if="scope.row.status==='已取消'" type="danger">{{ scope.row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="consigneeName" label="收货人姓名"></el-table-column>
          <el-table-column prop="consigneeTel" label="收货人电话"></el-table-column>
          <el-table-column prop="consigneeAddress" label="收货人地址"></el-table-column>
          <el-table-column prop="trackingNumber" label="快递单号"></el-table-column>
          <el-table-column prop="remark" label="备注"></el-table-column>
          <el-table-column prop="createTime" label="创建时间"></el-table-column>
          <el-table-column fixed="right" label="操作" width="120">
            <template #default="scope">
              <el-button type="primary" link v-if="scope.row.status==='待支付'" @click="pay(scope.row)">付款
              </el-button>
              <el-popconfirm title="确认取消订单吗?" @confirm="cancel(scope.row)">
                <template #reference>
                  <el-button link type="danger" v-if="scope.row.status==='待支付'">取消
                  </el-button>
                </template>
              </el-popconfirm>
              <el-popconfirm title="确收收货后钱会打款给卖家，是否继续?" @confirm="confirm(scope.row)">
                <template #reference>
                  <el-button link type="success" v-if="scope.row.status==='待收货'">确认收货</el-button>
                </template>
              </el-popconfirm>
              <el-button type="primary" @click="showAddEvaluate(scope.row)"
                         v-if="!scope.row.orderEvaluateId&&scope.row.status==='已完成'">
                写评价
              </el-button>
              <el-button type="success" v-if="scope.row.orderEvaluateId" @click="showEvaluate(scope.row)">查看评价
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top: 20px">
          <el-pagination
              @current-change="currentChange"
              @size-change="sizeChange"
              :page-size="pageInfo.pageSize"
              :current-page="pageInfo.currentPage"
              background
              layout="total,sizes, prev, pager, next"
              :total="pageInfo.total">
          </el-pagination>
        </div>
      </el-space>
    </el-card>
  </div>

  <el-dialog
      v-model="productOrderEvaluateDialogVisible"
      v-if="!productOrderEvaluate.id"
      title="评价"
      width="500"
  >
    <el-form :model="productOrderEvaluate" label-width="80px">
      <el-form-item label="评分">
        <el-rate
            v-model="productOrderEvaluate.rate"
            show-score
            text-color="#ff9900"
            score-template="{value} 分"
        />
      </el-form-item>
      <el-form-item label="详细内容">
        <el-input v-model="productOrderEvaluate.content" type="textarea"/>
      </el-form-item>
      <el-form-item label="">
        <el-button type="primary" @click="addEvaluate">提交</el-button>
        <el-button @click="productOrderEvaluateDialogVisible=false">取消</el-button>
      </el-form-item>
    </el-form>
  </el-dialog>


  <el-dialog
      v-model="productOrderEvaluateDialogVisible"
      v-if="productOrderEvaluate.id"
      title="评价详情"
      width="500"
  >
    <el-descriptions title="" column="1">
      <el-descriptions-item label="评分">
        <el-rate
            v-model="productOrderEvaluate.rate"
            disabled
            show-score
            text-color="#ff9900"
            score-template="{value} 分"
        />
      </el-descriptions-item>
      <el-descriptions-item label="详细内容">{{ productOrderEvaluate.content }}</el-descriptions-item>
      <el-descriptions-item label="评价时间">{{ productOrderEvaluate.createTime }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>


</template>

<script setup>
import request from "@/utils/http.js";
import {Check, Close, Delete, Edit, Refresh, Plus, Search} from '@element-plus/icons-vue'
import {ref, toRaw} from "vue";
import {ElMessage, ElMessageBox} from "element-plus";

const tableComponents = ref();
const listData = ref([]);
const pageInfo = ref({
  //当前页
  pageNum: 1,
  //分页大小
  pageSize: 10,
  //总条数
  total: 0
});
const searchForm = ref({
  status: ""
});

getPageList()

/**
 * 获取分页数据
 */
function getPageList() {
  let data = Object.assign(toRaw(searchForm.value), toRaw(pageInfo.value))
  request.get("/productOrder/page", {
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
  console.log(e)
}

function pay(row) {
  request.post("/productOrder/pay/" + row.id).then(res => {
    if (!res) {
      return
    }
    ElMessage({
      message: "操作成功",
      type: 'success'
    });
    getPageList();
  })
}

function cancel(row) {
  request.post("/productOrder/cancel/" + row.id).then(res => {
    if (!res) {
      return
    }
    ElMessage({
      message: "操作成功",
      type: 'success'
    });
    getPageList();
  })
}

function confirm(row) {
  request.post("/productOrder/confirm/" + row.id).then(res => {
    if (!res) {
      return
    }
    ElMessage({
      message: "操作成功",
      type: 'success'
    });
    getPageList();
  })
}


const productOrderEvaluateDialogVisible = ref(false)
const productOrderEvaluate = ref({})

function showAddEvaluate(row) {
  productOrderEvaluate.value = {}
  productOrderEvaluate.value.productOrderId = row.id
  productOrderEvaluate.value.productId = row.productId
  productOrderEvaluateDialogVisible.value = true
}

function addEvaluate() {
  request.post("/productOrderEvaluate/add", productOrderEvaluate.value).then(res => {
    if (!res) {
      return
    }
    productOrderEvaluateDialogVisible.value = false
    ElMessage({
      message: "评价成功",
      type: 'success'
    });
    getPageList()
  })
}


function showEvaluate(row) {
  request.get("/productOrderEvaluate/selectById/" + row.orderEvaluateId).then(res => {
    productOrderEvaluate.value = res.data
    productOrderEvaluateDialogVisible.value = true
  })
}


</script>

<style scoped>

</style>