<template>
  <div class="shopping-cart-container">
    <el-card class="cart-card ui-card">
      <el-space direction="vertical" alignment="left" style="width: 100%" :size="16">
        <el-table ref="tableComponents"
                  :data="listData"
                  tooltip-effect="dark"
                  style="width: 100%"
                  @selection-change="selectionChange">
          <el-table-column type="selection" width="40"></el-table-column>
          <el-table-column prop="id" label="">
            <template #default="scope">
              <el-space size="large">
                <el-image class="product-image img-container" style="width: 80px;height: 80px;" fit="contain"
                          :src="scope.row.productMainImg"
                >
                  <template #placeholder>
                    <div class="image-loading skeleton"></div>
                  </template>
                  <template #error>
                    <div class="image-error">加载失败</div>
                  </template>
                </el-image>
                <el-space direction="vertical" alignment="left">
                  <h3 class="product-name optimized-text">
                    {{ scope.row.productName }}
                  </h3>
                </el-space>
              </el-space>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="" width="200">
            <template #default="scope">
              <span class="price-text">￥{{ scope.row.quantity * scope.row.productPrice }} </span>
            </template>
          </el-table-column>
          <el-table-column fixed="right" prop="quantity" label="" width="200">
            <template #default="scope">
              <el-space size="large">
                <el-input-number v-model="scope.row.quantity" @change="handleQuantityChange(scope.row)" size="default"
                                 class="quantity-input" style="width: 120px"/>
                <el-button link type="danger" class="delete-btn clickable-area" @click="deleteOne(scope.$index, scope.row)">删除</el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>
        <div class="checkout-section">
          <el-space :size="16">
            <el-tag type="primary" class="checkout-tag">结算后，购物车会自动清除</el-tag>
            <span class="total-label">合计</span>
            <span class="price-text total-price">￥{{ totalPrice }}</span>
            <el-button type="danger" class="checkout-btn ui-button clickable-area" @click="buy" :disabled="selectionRows.length<=0">结算</el-button>
          </el-space>
        </div>

      </el-space>
    </el-card>
  </div>
  <el-dialog
      v-model="buyDialogOpen"
      v-if="buyDialogOpen"
      title="填写订单信息"
      width="500"
      class="order-dialog"
  >
    <el-form ref="buyFormRef" :model="productOrder" label-width="100px">
      <slot name="content">
        <el-form-item label="收货地址" prop="shippingAddressId"
                      :rules="[{required:true,message:'请输入选择地址',trigger:[ 'blur','change']}]">
          <el-select v-model="productOrder.shippingAddressId" placeholder="请选择" filterable class="address-select">
            <el-option :label="item.name+'_'+item.tel+'_'+item.address" :value="item.id" :key="item.id"
                       v-for="item in shippingAddressList"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input type="textarea" :rows="5" v-model="productOrder.remark" class="remark-input"></el-input>
        </el-form-item>
      </slot>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="createOrder" :icon="Check" class="submit-btn ui-button clickable-area">提交</el-button>
        <el-button @click="buyDialogOpen=false" :icon="Close" class="cancel-btn clickable-area">取消</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 购物车容器样式 */
.shopping-cart-container {
  width: 80%;
  max-width: 1200px;
  margin: 24px auto; /* 使用8的倍数 */
  padding: 0 24px; /* 使用8的倍数 */
}

/* 加载状态样式 */
.loading-container {
  padding: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 购物车卡片样式 */
.cart-card {
  border-radius: 10px; /* 圆角建议8px~12px */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06); /* 轻微阴影 */
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
  overflow: hidden;
  margin-bottom: 24px; /* 使用8的倍数 */
}

/* 商品图片样式 */
.product-image {
  border-radius: 8px; /* 圆角建议8px~12px */
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
}

.product-image:hover {
  transform: scale(1.03); /* 轻微放大效果 */
}

/* 图片加载和错误状态 */
.image-loading, .image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80px;
  width: 80px;
  color: var(--neutral-600);
  background: var(--neutral-200);
  font-size: 12px;
  border-radius: 8px; /* 圆角建议8px~12px */
}

/* 商品名称样式 */
.product-name {
  margin: 0;
  font-size: 16px;
  font-weight: 500; /* 字重用 400、500、700 */
  color: var(--neutral-900);
  line-height: 1.4;
}

/* 价格文本样式 */
.price-text {
  color: var(--secondary-color);
  font-size: 16px;
  font-weight: 700; /* 字重用 400、500、700 */
  background: linear-gradient(135deg, var(--secondary-color), var(--secondary-dark));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 1px 1px rgba(0,0,0,0.05);
}

.total-price {
  font-size: 20px;
}

/* 数量输入框样式 */
.quantity-input {
  border-radius: 8px; /* 圆角建议8px~12px */
}

/* 删除按钮样式 */
.delete-btn {
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
  font-weight: 500; /* 字重用 400、500、700 */
}

.delete-btn:hover {
  transform: translateX(-2px);
}

/* 结算区域样式 */
.checkout-section {
  text-align: right;
  padding: 16px 0; /* 使用8的倍数 */
  border-top: 1px solid var(--neutral-200);
  margin-top: 16px; /* 使用8的倍数 */
}

.checkout-tag {
  border-radius: 8px; /* 圆角建议8px~12px */
  padding: 8px 16px; /* 使用8的倍数 */
  font-weight: 500; /* 字重用 400、500、700 */
}

.total-label {
  font-size: 16px;
  font-weight: 500; /* 字重用 400、500、700 */
  color: var(--neutral-700);
}

/* 结算按钮样式 */
.checkout-btn {
  border-radius: 8px; /* 圆角建议8px~12px */
  padding: 8px 24px; /* 使用8的倍数 */
  font-weight: 500; /* 字重用 400、500、700 */
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.2);
}

.checkout-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(220, 53, 69, 0.3);
}

/* 订单对话框样式 */
.order-dialog {
  border-radius: 10px; /* 圆角建议8px~12px */
  overflow: hidden;
}

.address-select, .remark-input {
  width: 100%;
  border-radius: 8px; /* 圆角建议8px~12px */
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px; /* 使用8的倍数 */
  padding-top: 16px; /* 使用8的倍数 */
}

.submit-btn {
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(64, 158, 255, 0.3);
}

.cancel-btn {
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
}

.cancel-btn:hover {
  transform: translateY(-2px);
  background-color: var(--neutral-100);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .shopping-cart-container {
    width: 95%;
    padding: 0 16px; /* 使用8的倍数 */
  }
  
  .product-name {
    font-size: 14px;
  }
  
  .price-text {
    font-size: 14px;
  }
  
  .total-price {
    font-size: 18px;
  }
  
  .checkout-section {
    padding: 8px 0; /* 使用8的倍数 */
  }
  
  .checkout-tag {
    padding: 4px 8px; /* 使用8的倍数 */
  }
  
  .checkout-btn {
    padding: 8px 16px; /* 使用8的倍数 */
  }
  
  .dialog-footer {
    gap: 8px; /* 使用8的倍数 */
  }
}

/* 更小屏幕的响应式设计 */
@media (max-width: 480px) {
  .shopping-cart-container {
    width: 100%;
    padding: 0 8px; /* 使用8的倍数 */
  }
  
  .image-loading, .image-error {
    height: 64px;
    width: 64px;
  }
  
  .product-name {
    font-size: 12px;
  }
  
  .price-text {
    font-size: 12px;
  }
  
  .total-label {
    font-size: 14px;
  }
  
  .total-price {
    font-size: 16px;
  }
}

.cart-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

/* 购物车头部样式 */
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.cart-icon {
  font-size: 24px;
  color: #409eff;
}

.cart-badge {
  margin-left: 8px;
}

/* 空购物车样式 */
.empty-cart {
  padding: 60px 20px;
  text-align: center;
}

/* 购物车表格样式 */
.cart-table {
  border-radius: 8px;
  overflow: hidden;
}

.cart-table :deep(.el-table__header) {
  background-color: #f8f9fa;
}

.cart-table :deep(.el-table__row) {
  transition: all 0.3s ease;
}

.cart-table :deep(.el-table__row:hover) {
  background-color: #f0f9ff;
  transform: translateY(-1px);
}

/* 商品信息样式 */
.product-info {
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.product-info:hover {
  background-color: #f0f9ff;
  transform: translateX(4px);
}

.product-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.product-image:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: #f5f7fa;
  color: #c0c4cc;
}

.product-details {
  flex: 1;
}

.product-name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-price {
  margin: 0;
  font-size: 14px;
  color: #909399;
}

/* 价格显示样式 */
.price-display {
  text-align: center;
}

.total-price {
  font-size: 18px;
  font-weight: 600;
  color: #f56c6c;
  text-shadow: 0 1px 2px rgba(245, 108, 108, 0.2);
}

/* 数量控制样式 */
.quantity-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

.quantity-input {
  width: 120px;
}

.quantity-input :deep(.el-input-number__decrease),
.quantity-input :deep(.el-input-number__increase) {
  transition: all 0.3s ease;
}

.quantity-input :deep(.el-input-number__decrease):hover,
.quantity-input :deep(.el-input-number__increase):hover {
  background-color: #409eff;
  color: white;
}

.delete-btn {
  color: #f56c6c;
  transition: all 0.3s ease;
  padding: 8px 12px;
  border-radius: 6px;
}

.delete-btn:hover {
  background-color: #fef0f0;
  color: #f56c6c;
  transform: translateY(-1px);
}

/* 结算区域样式 */
.checkout-area {
  margin-top: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.checkout-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.checkout-tip {
  display: flex;
  align-items: center;
  gap: 4px;
}

.selected-count {
  font-size: 14px;
  color: #606266;
}

.checkout-total {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.total-label {
  font-size: 16px;
  color: #303133;
  font-weight: 500;
}

.total-amount {
  font-size: 24px;
  font-weight: 700;
  color: #f56c6c;
  text-shadow: 0 2px 4px rgba(245, 108, 108, 0.2);
}

.checkout-btn {
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3);
}

.checkout-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 108, 108, 0.4);
}

.checkout-btn:active {
  transform: translateY(0);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .shopping-cart-container {
    width: 95%;
    padding: 0 10px;
  }
  
  .product-info {
    flex-direction: column;
    text-align: center;
  }
  
  .checkout-total {
    flex-direction: column;
    gap: 12px;
  }
  
  .checkout-btn {
    width: 100%;
  }
}

/* 动画效果 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cart-content {
  animation: fadeInUp 0.6s ease-out;
}

/* 加载动画 */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.loading-container {
  animation: pulse 1.5s ease-in-out infinite;
}
</style>

<script setup>
import request from "@/utils/http.js";
import {Check, Close, Delete, Edit, Refresh, Plus, Search} from '@element-plus/icons-vue'
import {computed, ref, toRaw} from "vue";
import {ElMessage, ElMessageBox} from "element-plus";
import router from "@/router/index.js";

const tableComponents = ref();
const listData = ref([]);
const pageInfo = ref({
  //当前页
  pageNum: 1,
  //分页大小
  pageSize: 10,
});

getPageList()

/**
 * 获取分页数据
 */
function getPageList() {
  request.get("/shoppingCart/page", {
    params: pageInfo.value
  }).then(res => {
    listData.value = res.data.list
  })
}

const selectionRows = ref([]);

/**
 * 多选
 * @param rows
 */
function selectionChange(rows) {
  selectionRows.value = rows
}

/**
 * 单个删除
 * @param index
 * @param row
 */
function deleteOne(index, row) {
  batchDelete([row])
}

/**
 * 批量删除
 * @param rows
 */
function batchDelete(rows) {
  if (!rows) {
    rows = selectionRows.value;
  }
  let ids = rows.map(item => item.id);
  ElMessageBox.confirm(`此操作将永久删除ID为[${ids}]的数据, 是否继续?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
    center: true
  }).then(() => {
    request.delete("/shoppingCart/delBatch", {data: ids}).then(res => {
      if (!res) {
        return
      }
      ElMessage({
        message: "操作成功",
        type: 'success'
      });
      getPageList()
    })
  }).catch(() => {
    ElMessage({
      type: 'info',
      message: '已取消删除'
    });
    tableComponents.value.clearSelection();
  });
}

function handleQuantityChange(row) {
  // 防抖处理
  clearTimeout(row.timer);
  row.timer = setTimeout(() => {
    request.put("/shoppingCart/update", row).then(res => {
      if (!res) {
        return
      }
      ElMessage({
        message: "数量已更新",
        type: 'success',
        duration: 1500
      });
    }).catch(() => {
      ElMessage({
        message: "更新失败，请重试",
        type: 'error'
      });
    });
  }, 800);
}


const totalPrice = computed(() => {
  let totalPrice = 0;
  selectionRows.value.forEach(item => {
    totalPrice += item.quantity * item.productPrice;
  })
  return totalPrice;
});


const shippingAddressList = ref([])
getShippingAddressList();

async function getShippingAddressList() {
  let data = {
    pageNum: 1,
    pageSize: 100
  }
  request.get("/shippingAddress/page", {
    params: data
  }).then(res => {
    shippingAddressList.value = res.data.list;
  })
}


const buyDialogOpen = ref(false)
const productOrder = ref({})
const buyFormRef = ref()
const buyLoading = ref()

function buy() {
  buyLoading.value = true;
  // 模拟加载延迟
  setTimeout(() => {
    productOrder.value = {}
    productOrder.value.ids = selectionRows.value.map(item => item.id);
    buyDialogOpen.value = true;
    buyLoading.value = false;
  }, 500);
}

function createOrder() {
  buyFormRef.value.validate((valid) => {
    if (!valid) {
      ElMessage({
        message: "验证失败，请检查表单!",
        type: 'warning'
      });
      return
    }
    let shippingAddress = shippingAddressList.value.find(item => item.id == productOrder.value.shippingAddressId);
    productOrder.value.consigneeName = shippingAddress.name;
    productOrder.value.consigneeTel = shippingAddress.tel;
    productOrder.value.consigneeAddress = shippingAddress.address;
    request.post("/shoppingCart/createOrder", productOrder.value).then(res => {
      if (!res) {
        return
      }
      buyDialogOpen.value = false
      ElMessage({
        message: "操作成功",
        type: 'success'
      });
      router.push("/productOrder")
    })
  })
}

</script>

<style scoped>

</style>