<template>
  <div class="product-list-container">
    <div class="left-sidebar">
      <el-tabs 
        tab-position="left" 
        v-model="searchForm.productTypeId" 
        @tab-change="getPageList"
        class="category-tabs"
      >
        <el-tab-pane 
          v-for="item in productTypeList" 
          :key="item.id"
          :label="item.name" 
          :name="item.id"
        ></el-tab-pane>
      </el-tabs>
    </div>

    <div class="main-content">
      <el-space direction="vertical" alignment="left" style="width: 100%" size="large">
        <!-- 店铺信息卡片 -->
        <el-card v-if="shopId" class="shop-card">
          <Shop :shopId="shopId"></Shop>
        </el-card>

        <!-- 搜索栏 -->
        <div class="search-bar">
          <el-input 
            v-model="searchForm.name" 
            placeholder="请输入你感兴趣的商品" 
            size="large"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button 
            type="primary" 
            @click="search"
            size="large"
            class="search-button"
          >
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
        </div>

        <!-- 商品列表 -->
        <div class="products-grid">
          <Product 
            v-for="item in listData" 
            :key="item.id" 
            :product="item"
            class="product-item"
          />
        </div>

        <!-- 分页器 -->
        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="pageInfo.currentPage"
            v-model:page-size="pageInfo.pageSize"
            :page-sizes="[24, 36, 48, 60]"
            :total="pageInfo.total"
            @size-change="sizeChange"
            @current-change="currentChange"
            background
            layout="total, sizes, prev, pager, next"
          >
          </el-pagination>
        </div>
      </el-space>
    </div>
  </div>
</template>

<script setup>
import { ref, toRaw, onMounted } from "vue";
import { ElMessage } from "element-plus";
import request from "@/utils/http.js";
import { Search } from '@element-plus/icons-vue'
import router from "@/router/index.js";
import { useRoute } from "vue-router";
import Shop from "@/components/Shop.vue";
import Product from "@/components/Product.vue";


const searchFormComponents = ref();
const tableComponents = ref();
const listData = ref([]);
const pageInfo = ref({
  //当前页
  pageNum: 1,
  //分页大小
  pageSize: 24,
  //总条数
  total: 0
});
const searchForm = ref({
  name: undefined,
  productTypeId: ''
});

const route = useRoute()
//店铺详情需要店铺的id
const shopId = ref(null)
if (route.query.shopId) {
  shopId.value = route.query.shopId
  searchForm.value.shopId = route.query.shopId
}

if (route.query.name) {
  searchForm.value.name = route.query.name
}

const productTypeList = ref([])

getProductTypeList()

async function getProductTypeList() {
  try {
    const res = await request.get("/productType/list");
    if (res.data) {
      productTypeList.value = res.data;
      productTypeList.value.unshift({id: '', name: '全部'});
    } else {
      productTypeList.value = [{id: '', name: '全部'}];
      ElMessage.warning('获取商品分类失败');
    }
  } catch (error) {
    console.error('获取商品分类失败:', error);
    productTypeList.value = [{id: '', name: '全部'}];
    ElMessage.error('获取商品分类失败，请稍后重试');
  }
}


getPageList()

/**
 * 获取分页数据
 */
async function getPageList() {
  try {
    const data = Object.assign(toRaw(searchForm.value), toRaw(pageInfo.value));
    const res = await request.get("/product/page", {
      params: data
    });
    if (res.data && Array.isArray(res.data.list)) {
      listData.value = res.data.list;
      pageInfo.value.total = res.data.total;

      // 搜索完成后清空搜索框与路由参数，避免保留历史关键词
      searchForm.value.name = undefined; // 清空输入框
      try {
        const q = { ...route.query };
        delete q.name; // 从路由Query移除关键词
        router.replace({ query: q });
      } catch (e) {
        // 忽略路由清理异常
      }
    } else {
      listData.value = [];
      pageInfo.value.total = 0;
      ElMessage.warning('暂无商品数据');
    }
  } catch (error) {
    console.error('获取商品列表失败:', error);
    listData.value = [];
    pageInfo.value.total = 0;
    ElMessage.error('获取商品列表失败，请稍后重试');
  }
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

/**
 * 搜索
 */
function search() {
  pageInfo.value.pageNum = 1
  getPageList()
}


</script>

<style scoped>
.product-list-container {
  display: flex;
  gap: 24px;
  width: 90%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
  min-height: 100vh;
  border-radius: var(--border-radius-large);
  background: linear-gradient(to bottom, var(--bg-color), var(--bg-light));
  box-shadow: var(--box-shadow-light);
  backdrop-filter: blur(10px);
  transition: all var(--transition-duration) var(--transition-timing);
}

.left-sidebar {
  padding: 24px 16px;
  border-right: 1px solid rgba(235, 238, 245, 0.5);
  background: var(--bg-color);
  border-radius: var(--border-radius-large);
  box-shadow: var(--box-shadow-light);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 24px;
  height: fit-content;
  min-width: 220px;
  transition: all var(--transition-duration) var(--transition-timing);
}

.main-content {
  flex: 1;
  padding: 20px;
}

.shop-card {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  background: linear-gradient(to right, #ffffff, #f8f9fa);
  transition: transform 0.3s ease;
}

.shop-card:hover {
  transform: translateY(-2px);
}

.search-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  position: sticky;
  top: 24px;
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.5);
  padding: 16px;
  border-radius: var(--border-radius);
  backdrop-filter: blur(8px);
  box-shadow: var(--box-shadow-light);
  transition: all var(--transition-duration) var(--transition-timing);
}

.search-bar :deep(.el-input) {
  flex: 1;
  transition: all 0.3s ease;
}

.search-bar :deep(.el-input__wrapper) {
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow-light);
  background: var(--bg-color);
  backdrop-filter: blur(8px);
  transition: all var(--transition-duration) var(--transition-timing);
  border: 1px solid var(--border-light);
}

.search-bar :deep(.el-input__wrapper:hover),
.search-bar :deep(.el-input__wrapper.is-focus) {
  box-shadow: var(--box-shadow);
  transform: translateY(-1px);
  border-color: var(--primary-light);
}

.search-button {
  border-radius: var(--border-radius);
  background: var(--primary-gradient);
  border: none;
  padding: 0 32px;
  transition: all var(--transition-duration) var(--transition-timing);
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(255, 80, 0, 0.3);
}

.search-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 80, 0, 0.4);
  background: linear-gradient(135deg, var(--primary-dark), var(--primary-color));
}

.search-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(255, 80, 0, 0.2);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
  margin-top: 24px;
  width: 100%;
  transition: all var(--transition-duration) var(--transition-timing);
}

@media (max-width: 1440px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
}

.product-item {
  width: 100%;
  height: 100%;
}

.product-col {
  margin-bottom: 20px;
}

.pagination-wrapper {
  margin-top: 32px;
  padding: 16px 0;
  display: flex;
  justify-content: center;
  position: sticky;
  bottom: 0;
  background: linear-gradient(to top, var(--bg-color), rgba(255, 255, 255, 0.8));
  backdrop-filter: blur(8px);
  z-index: 10;
  border-top: 1px solid var(--border-light);
}

.pagination-wrapper :deep(.el-pagination) {
  padding: 16px 24px;
  background: var(--bg-color);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow-light);
  transition: all var(--transition-duration) var(--transition-timing);
}

.pagination-wrapper :deep(.el-pagination .el-pagination__total),
.pagination-wrapper :deep(.el-pagination .el-pagination__jump) {
  margin-left: 16px;
  color: #606266;
}

.pagination-wrapper :deep(.el-pagination .el-pager li) {
  border-radius: 6px;
  transition: all 0.3s ease;
}

.pagination-wrapper :deep(.el-pagination .el-pager li:not(.is-disabled):hover) {
  color: #ff5000;
  background-color: rgba(255, 80, 0, 0.1);
}

.pagination-wrapper :deep(.el-pagination .el-pager li.is-active) {
  background-color: #ff5000;
  color: white;
}

.pagination-wrapper :deep(.el-pagination .btn-prev),
.pagination-wrapper :deep(.el-pagination .btn-next) {
  border-radius: 6px;
  transition: all 0.3s ease;
}

.pagination-wrapper :deep(.el-pagination .el-pagination__sizes .el-input__wrapper) {
  border-radius: 6px;
  transition: all 0.3s ease;
}

.pagination-wrapper :deep(.el-pagination .el-pagination__sizes .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #ff5000 inset;
}

.category-tabs :deep(.el-tabs__item) {
  padding: 0 24px;
  height: 48px;
  line-height: 48px;
  transition: all var(--transition-duration) var(--transition-timing);
  color: var(--text-regular);
  font-weight: 500;
  position: relative;
  overflow: hidden;
  margin: 4px 0;
  border-radius: var(--border-radius);
}

.category-tabs :deep(.el-tabs__item.is-active) {
  color: var(--primary-color);
  font-weight: 600;
  background: linear-gradient(to right, rgba(255, 80, 0, 0.1), transparent);
}

.category-tabs :deep(.el-tabs__item:hover) {
  color: var(--primary-light);
  background: linear-gradient(to right, rgba(255, 80, 0, 0.08), transparent);
  transform: translateX(5px);
}

.category-tabs :deep(.el-tabs__active-bar) {
  background: var(--primary-gradient);
  height: 3px;
  border-radius: 3px;
  transition: all var(--transition-duration) var(--transition-timing);
}

.category-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: rgba(235, 238, 245, 0.5);
}

.category-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.main-content {
  flex: 1;
  padding: 20px 20px 20px 0;
}

.shop-card {
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
}

.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-bar .el-input {
  flex: 1;
}

.search-button {
  background-color: #ff5000;
  border-color: #ff5000;
  transition: all 0.3s;
}

.search-button:hover {
  background-color: #ff6a00;
  border-color: #ff6a00;
  transform: translateY(-1px);
}

.products-grid {
  min-height: 400px;
}

.product-col {
  margin-bottom: 20px;
}

.pagination-wrapper {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .product-list-container {
    width: 95%;
    flex-direction: column;
  }

  .left-sidebar {
    padding: 10px;
    border-right: none;
    border-bottom: 1px solid #ebeef5;
  }

  .main-content {
    padding: 10px;
  }

  .search-bar {
    flex-direction: column;
  }

  .search-button {
    width: 100%;
  }
}
</style>