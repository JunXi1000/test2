<template>
  <div class="product-details-container" v-if="info.id">
    <el-card v-if="info.id" class="product-main-card ui-card" shadow="never">
      <el-row :gutter="30">
        <el-col :xs="24" :sm="24" :md="10" :lg="10">
          <div class="product-image-section img-container">
            <el-carousel :interval="4000" type="card" indicator-position="outside" class="image-carousel" height="400px">
              <el-carousel-item v-for="item in info.imgList.split(',')" :key="item">
                <el-image 
                  :src="item" 
                  fit="contain"
                  :preview-src-list="info.imgList.split(',')"
                  class="carousel-image"
                  loading="lazy"
                >
                  <template #placeholder>
                    <div class="image-loading skeleton">
                      <el-icon class="is-loading"><Loading /></el-icon>
                      <span>加载中...</span>
                    </div>
                  </template>
                  <template #error>
                    <div class="image-error">
                      <el-icon><Picture /></el-icon>
                      <span>图片加载失败</span>
                    </div>
                  </template>
                </el-image>
              </el-carousel-item>
            </el-carousel>
            <div class="image-zoom-hint">
              <el-icon><ZoomIn /></el-icon>
              <span>点击查看大图</span>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="24" :md="14" :lg="14">
          <el-space direction="vertical" alignment="left" style="width: 100%" class="product-info-section">
            <div class="product-title">
              <h1>{{ info.name }}</h1>
            </div>
            <div class="price-section">
              <span class="price-label">价格</span>
              <span class="current-price">￥{{ info.price }}</span>
              <span class="original-price" v-if="info.originalPrice">￥{{ info.originalPrice }}</span>
            </div>
            <div class="stats-section">
              <el-space size="large">
                <el-statistic title="库存" :value="info.stock"/>
                <el-statistic title="销量" :value="info.salesVolume"/>
              </el-space>
            </div>
            <div class="service-section">
              <el-space direction="vertical" alignment="left">
                <el-space spacer="|">
                  <el-tag type="success">准时达</el-tag>
                  <span>承诺24小时内发货，超时必赔</span>
                </el-space>
                <el-space spacer="|">
                <span>
                    <el-icon :size="18" color="green"><CircleCheck/></el-icon> 7天价保</span>
                  <span>买贵双倍赔</span>
                </el-space>

                <el-space spacer="|">
                  <span>包邮</span>
                  <span>免费上门退换</span>
                  <span>破损包退换</span>
                  <span>上门换新</span>
                </el-space>
              </el-space>
            </div>
            <div class="action-buttons">
              <el-button 
                type="danger" 
                @click="buy" 
                class="buy-btn ui-button clickable-area"
                size="large"
              >
                <el-icon><ShoppingBag /></el-icon>
                <span class="btn-text">立即购票</span>
              </el-button>

              <div class="secondary-buttons">
                <el-button 
                  :type="info.productCollectId ? 'info' : 'warning'" 
                  @click="info.productCollectId ? removeCollect() : addCollect()" 
                  class="collect-btn ui-button clickable-area"
                  size="large"
                >
                  <el-icon><Star /></el-icon>
                  <span class="btn-text">{{ info.productCollectId ? '取消收藏' : '收藏' }}</span>
                </el-button>

                <el-button 
                  type="primary" 
                  @click="addShoppingCart" 
                  class="cart-btn ui-button clickable-area"
                  size="large"
                >
                  <el-icon><ShoppingCart /></el-icon>
                  <span class="btn-text">加入购物车</span>
                </el-button>
              </div>
            </div>
          </el-space>
        </el-col>
      </el-row>

      <el-divider></el-divider>
      <Shop :shopId="info.shopId"></Shop>

      <el-divider></el-divider>
      <el-tabs v-model="activeName" class="product-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="图文详情" name="first">
          <transition name="fade" mode="out-in">
            <div class="content tab-content" v-html="info.intro" style="margin: 0 auto; width: 75%;" v-show="activeName === 'first'"></div>
          </transition>
        </el-tab-pane>
        <el-tab-pane label="评价" name="second">
          <transition name="fade" mode="out-in">
            <div class="tab-content" v-show="activeName === 'second'">
              <ProductOrderEvaluate :productId="info.id"/>
            </div>
          </transition>
        </el-tab-pane>
      </el-tabs>
    </el-card>
    <el-dialog
        v-model="buyDialogOpen"
        v-if="buyDialogOpen"
        title="填写订单信息"
        width="500"
        :teleported="true"          
        append-to-body               
        :modal-append-to-body="true" 
        :lock-scroll="true"        
        destroy-on-close            
        :close-on-click-modal="false"
    >
      <el-form ref="buyFormRef" :model="productOrder" label-width="100px">
        <slot name="content">
          <el-form-item label="收货地址" prop="shippingAddressId"
                        :rules="[{required:true,message:'请输入选择地址',trigger:[ 'blur','change']}]">
            <el-select v-model="productOrder.shippingAddressId" placeholder="请选择" filterable>
              <el-option :label="item.name+'_'+item.tel+'_'+item.address" :value="item.id" :key="item.id"
                         v-for="item in shippingAddressList"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="数量" prop="quantity"
                        :rules="[{required:true,message:'请输入购买数量',trigger:[ 'blur','change']}]">
            <el-input-number v-model="productOrder.quantity" :min="1"/>
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input type="textarea" :rows="5" v-model="productOrder.remark"></el-input>
          </el-form-item>
        </slot>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="buySubmit" :icon="Check">提交</el-button>
          <el-button @click="buyDialogOpen=false" :icon="Close">取消</el-button>
        </div>
      </template>
    </el-dialog>


  </div>
</template>

<style scoped>
.product-details-container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
  background-color: var(--bg-color);
}

.product-main-card {
  background: var(--bg-gradient);
  border-radius: var(--border-radius-large);
  overflow: hidden;
  box-shadow: var(--box-shadow-light);
  border: 1px solid var(--border-lighter);
}

.product-image-section {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.image-carousel {
  border-radius: 8px;
  margin-bottom: 10px;
}

.carousel-image {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  transition: transform 0.3s ease;
  object-fit: contain;
  background-color: #fff;
}

.carousel-image:hover {
  transform: scale(1.05);
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .product-details-container {
    margin: 1rem auto;
    padding: 0 0.5rem;
  }
  
  .image-carousel {
    height: 300px !important;
  }
  
  .product-info-section {
    padding: 1rem 0.5rem !important;
  }
  
  .product-title h1 {
    font-size: 1.5rem !important;
  }
  
  .current-price {
    font-size: 1.8rem !important;
  }
  
  .action-buttons {
    flex-direction: column;
  }
}

.image-loading,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  color: #606266;
}

.product-info-section {
  padding: 1.5rem;
}

.product-title h1 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-light);
  position: relative;
}

.product-title h1::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 80px;
  height: 2px;
  background: var(--primary-gradient);
}

.price-section {
  margin: 1.5rem 0;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.price-label {
  font-size: 1rem;
  color: #909399;
}

.current-price {
  font-size: 2.2rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--secondary-color), var(--secondary-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
  letter-spacing: 1px;
}

.original-price {
  font-size: 1rem;
  color: var(--text-secondary);
  text-decoration: line-through;
}

.stats-section {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: var(--bg-light);
  border-radius: var(--border-radius-medium);
  box-shadow: var(--box-shadow-inset);
  border: 1px solid var(--border-lighter);
}

.service-section {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: var(--bg-gradient-horizontal);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-medium);
  box-shadow: var(--box-shadow-light);
}

.action-buttons {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.buy-btn {
  width: 100%;
  height: 50px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.secondary-buttons {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.secondary-buttons .el-button {
  flex: 1;
  height: 45px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.action-buttons .el-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--box-shadow);
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .secondary-buttons {
    flex-direction: column;
  }
  
  .btn-text {
    margin-left: 5px;
  }
}

.action-buttons .el-button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s ease, height 0.6s ease;
}

.action-buttons .el-button:active::after {
  width: 200%;
  height: 200%;
}

.product-tabs {
  margin-top: 2rem;
}

.tab-content {
  padding: 2rem;
  min-height: 300px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<script setup>
import request from "@/utils/http.js";
import {ref, toRaw} from "vue";
import {useRoute} from "vue-router";
import {Check, Close, Picture, ZoomIn, ShoppingBag, ShoppingCart, Star} from "@element-plus/icons-vue";
import {ElMessage} from "element-plus";
import router from "@/router/index.js";
import ProductOrderEvaluate from "@/components/ProductOrderEvaluate.vue";
import Shop from "@/components/Shop.vue";


const route = useRoute()
const id = ref(route.params.id)
const info = ref({});

getInfo()

function getInfo() {
  request.get("/product/selectById/" + id.value).then(res => {
    info.value = res.data;
  })
}


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

addBrowsingHistory();

/**
 * 添加浏览历史
 */
function addBrowsingHistory() {
  request.post("/productBrowsingHistory/add", {productId: id.value}).then(res => {

  })
}

function addCollect() {
  request.post("/productCollect/add", {productId: id.value}).then(res => {
    info.value.productCollectId = res.data.id
  })
}


function removeCollect() {
  let ids = [
    info.value.productCollectId
  ]
  request.delete("/productCollect/delBatch", {data: ids}).then(res => {
    info.value.productCollectId = null
  })
}


function addShoppingCart() {
  request.post("/shoppingCart/add", {productId: id.value, quantity: 1}).then(res => {
    ElMessage({
      message: "添加成功",
      type: 'success'
    });
  })
}


const buyDialogOpen = ref(false)
const productOrder = ref({})
const buyFormRef = ref()

function buy() {
  productOrder.value = {}
  productOrder.value.quantity = 1
  buyDialogOpen.value = true
}

function buySubmit() {
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
    productOrder.value.productId = id.value;
    request.post("/productOrder/add", productOrder.value).then(res => {
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

const activeName = ref('first')

// 标签页切换处理
function handleTabChange(tabName) {
  activeName.value = tabName
}


</script>

<style scoped>
/* 使用 ::v-deep 穿透作用域 */
::v-deep .content img {
  width: 100%;
}

/* 商品详情容器样式 */
.product-details-container {
  transition: all 0.3s ease;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.product-main-card {
  margin-bottom: 24px; /* 使用8的倍数 */
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0);
}

.product-main-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.09); /* 轻微阴影 */
}

/* 图片区域样式 */
.product-image-section {
  position: relative;
  margin-bottom: 16px; /* 使用8的倍数 */
}

.image-carousel {
  border-radius: 10px; /* 圆角建议8px~12px */
  overflow: hidden;
  margin-bottom: 16px; /* 使用8的倍数 */
  background-color: #fff;
}

.carousel-image {
  transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
  cursor: pointer;
  object-fit: contain;
  background-color: #fff;
}

.carousel-image:hover {
  transform: scale(1.03); /* 轻微放大效果 */
}

.image-zoom-hint {
  position: absolute;
  bottom: 16px; /* 使用8的倍数 */
  right: 16px; /* 使用8的倍数 */
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px; /* 使用8的倍数 */
  border-radius: 8px; /* 圆角建议8px~12px */
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px; /* 使用8的倍数 */
  opacity: 0;
  transition: opacity 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
  z-index: 2;
}

.product-image-section:hover .image-zoom-hint {
  opacity: 1;
}

.image-error, .image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--neutral-600);
  background: var(--neutral-200);
  gap: 8px; /* 使用8的倍数 */
  border-radius: 8px; /* 圆角建议8px~12px */
}

/* 商品信息区域样式 */
.product-info-section {
  padding: 0 24px; /* 使用8的倍数 */
}

.product-title h1 {
  margin: 0 0 16px 0; /* 使用8的倍数 */
  color: var(--neutral-900);
  font-weight: 700; /* 字重用 400、500、700 */
  font-size: 24px; /* 标题（18-24px） */
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.price-section {
  padding: 16px 0; /* 使用8的倍数 */
  border-bottom: 1px solid var(--neutral-200);
  margin-bottom: 16px; /* 使用8的倍数 */
}

.current-price {
  font-weight: 700; /* 字重用 400、500、700 */
  font-size: 28px !important;
  color: var(--secondary-color); /* 辅助色用于价格 */
  background: linear-gradient(135deg, var(--secondary-color), var(--secondary-dark));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 1px 1px rgba(0,0,0,0.05);
  letter-spacing: -0.02em;
}

.stats-section {
  padding: 16px 0; /* 使用8的倍数 */
  display: flex;
  gap: 24px; /* 使用8的倍数 */
  flex-wrap: wrap;
}

.service-section {
  padding: 16px 0; /* 使用8的倍数 */
  border-top: 1px solid var(--neutral-200);
  border-bottom: 1px solid var(--neutral-200);
  margin: 16px 0; /* 使用8的倍数 */
}

/* 按钮样式 */
.action-buttons {
  padding: 24px 0; /* 使用8的倍数 */
  display: flex;
  gap: 16px; /* 使用8的倍数 */
  flex-wrap: wrap;
}

.buy-btn, .cart-btn, .collect-btn {
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
  border-radius: 10px; /* 圆角建议8px~12px */
  font-weight: 500; /* 字重用 400、500、700 */
  letter-spacing: 0.5px;
  padding: 12px 24px; /* 使用8的倍数的组合 */
  min-height: 48px; /* 可点击区域 ≥ 44px（苹果规范） */
  position: relative;
  overflow: hidden;
}

/* 添加按钮点击效果 */
.buy-btn::after, .cart-btn::after, .collect-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.1);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.buy-btn:active::after, .cart-btn:active::after, .collect-btn:active::after {
  opacity: 1;
}

.buy-btn {
  background: linear-gradient(135deg, var(--secondary-color), var(--secondary-dark)) !important;
  border-color: var(--secondary-dark) !important;
  box-shadow: 0 4px 12px rgba(255, 149, 0, 0.2);
}

.buy-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(255, 149, 0, 0.3); /* 轻微阴影 */
  background: linear-gradient(135deg, var(--secondary-light), var(--secondary-color)) !important;
}

.cart-btn {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06); /* 轻微阴影 */
}

.cart-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1); /* 轻微阴影 */
  background: var(--primary-gradient);
}

.collect-btn {
  border: 1px solid var(--neutral-300);
}

.collect-btn:hover {
  transform: translateY(-2px);
  border-color: var(--neutral-400);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04); /* 轻微阴影 */
}

/* 添加响应式按钮样式 */
@media (max-width: 768px) {
  .action-buttons {
    gap: 8px; /* 在小屏幕上减小间距 */
  }
  
  .buy-btn, .cart-btn, .collect-btn {
    padding: 8px 16px; /* 在小屏幕上减小内边距 */
    font-size: 14px;
  }
}

/* 标签页样式 */
.product-tabs {
  margin-top: 24px; /* 使用8的倍数 */
  border-radius: 10px; /* 圆角建议8px~12px */
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06); /* 轻微阴影 */
  background-color: #fff;
}

.tab-content {
  min-height: 200px;
  padding: 24px; /* 使用8的倍数 */
  will-change: transform; /* 性能优化 */
  transform: translateZ(0); /* 性能优化 */
}

/* 标签页切换动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0), transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 常用时长：200ms~300ms */
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px); /* 使用8的倍数 */
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px); /* 使用8的倍数 */
}

/* 响应式设计 */
@media (max-width: 768px) {
  .product-details-container {
    padding: 0 8px; /* 在小屏幕上减小内边距 */
  }
  
  .product-main-card {
    margin-bottom: 16px; /* 使用8的倍数 */
  }
  
  .product-image-section,
  .product-info-section {
    padding: 0 16px; /* 使用8的倍数 */
  }
  
  .product-title h1 {
    font-size: 20px; /* 在小屏幕上减小字体大小 */
  }
  
  .current-price {
    font-size: 24px !important; /* 在小屏幕上减小字体大小 */
  }
  
  .stats-section {
    gap: 16px; /* 使用8的倍数 */
  }
  
  .tab-content {
    padding: 16px; /* 使用8的倍数 */
  }
  .action-buttons {
    flex-direction: column;
  }
  
  .buy-btn, .cart-btn, .collect-btn {
    width: 100%;
  }
}
</style>
