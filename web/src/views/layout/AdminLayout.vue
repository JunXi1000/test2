<template>
  <el-container class="admin-wrapper" style="height: 100%;">
    <el-aside width="200px" class="my-aside">
      <h3 class="title">管理系统</h3>
      <el-menu
          style="width: 100%; overflow: hidden;"
          active-text-color="#409EFF"
          background-color="#000000"
          text-color="white"
          :default-active="useRoute().path"
          @select="handleMenuSelect"
          router>
        <el-menu-item index="/admin">
          <el-icon>
            <HomeOutlined/>
          </el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/admin/admin" v-if="currentUser.type==='ADMIN'">
          <el-icon>
            <User/>
          </el-icon>
          <span>管理员管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/user" v-if="currentUser.type==='ADMIN'">
          <el-icon>
            <User/>
          </el-icon>
          <span>普通用户</span>
        </el-menu-item>
        <el-menu-item index="/admin/shop"  v-if="currentUser.type==='ADMIN'">
          <el-icon>
            <Shop/>
          </el-icon>
          <span>店铺</span>
        </el-menu-item>
        <el-sub-menu index="1">
          <template #title>
            <el-icon>
              <Picture/>
            </el-icon>
            <span>商品管理</span>
          </template>
          <el-menu-item index="/admin/productType" v-if="currentUser.type==='ADMIN'">
            <el-icon>
              <Folder/>
            </el-icon>
            <span>商品分类</span>
          </el-menu-item>
          <el-menu-item index="/admin/productCollect" v-if="currentUser.type==='ADMIN'">
            <el-icon>
              <Star/>
            </el-icon>
            <span>商品收藏</span>
          </el-menu-item>
          <el-menu-item index="/admin/product">
            <el-icon>
              <Goods/>
            </el-icon>
            <span>商品信息</span>
          </el-menu-item>
          <el-menu-item index="/admin/productBrowsingHistory" v-if="currentUser.type==='ADMIN'">
            <el-icon>
              <View/>
            </el-icon>
            <span>商品浏览历史</span>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/admin/shippingAddress" v-if="currentUser.type==='ADMIN'">
          <el-icon>
            <AddLocation/>
          </el-icon>
          <span>收货地址</span>
        </el-menu-item>
        <el-sub-menu index="2">
          <template #title>
            <el-icon>
              <Tickets/>
            </el-icon>
            <span>订单管理</span>
          </template>
          <el-menu-item index="/admin/productOrder">
            <el-icon>
              <Tickets/>
            </el-icon>
            <span>商品订单</span>
          </el-menu-item>
          <el-menu-item index="/admin/productOrderEvaluate"  v-if="currentUser.type==='ADMIN'">
            <el-icon>
              <Edit/>
            </el-icon>
            <span>订单评价</span>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/admin/shopCollect" v-if="currentUser.type==='ADMIN'">
          <el-icon>
            <Star/>
          </el-icon>
          <span>店铺收藏</span>
        </el-menu-item>
<!--        <el-sub-menu index="3" v-if="currentUser.type==='ADMIN'">-->
<!--          <template #title>-->
<!--            <el-icon>-->
<!--              <DataAnalysis/>-->
<!--            </el-icon>-->
<!--            <span>营销管理</span>-->
<!--          </template>-->
<!--          -->
<!--        </el-sub-menu>-->
        <el-menu-item index="/admin/slideshow">
          <el-icon>
            <Picture/>
          </el-icon>
          <span>轮播图</span>
        </el-menu-item>

      </el-menu>
    </el-aside>
    <el-container>

      <el-header height="60px">
        <el-row :gutter="5">
          <el-col :span="6" style="margin-top: 20px;">
            <el-space>
<!--              <router-link to="/admin">-->
<!--                <HomeOutlined/>-->
<!--              </router-link>-->
            </el-space>
          </el-col>
          <el-col :span="6">
          </el-col>
          <el-col :span="9">
          </el-col>
          <el-col :span="3">
            <div style="text-align: right;">
              <el-space style="margin-top: 15px;">
                <el-dropdown v-if="isUserLogin">
                  <div>
                    <el-space>
                      <el-avatar style="width: 30px;height: 30px;border-radius: 50%"
                                 shape="square" :size="30" :src="currentUser.avatarUrl"></el-avatar>
                      <span style="font-size: 16px">  {{ currentUser.username }}</span></el-space>
                  </div>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item><span @click="editCurrentUser">个人信息</span></el-dropdown-item>
                      <el-dropdown-item><span @click="editPassword">修改密码</span></el-dropdown-item>
                      <el-dropdown-item divided><span @click="logout">退出登录</span></el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

              </el-space>
            </div>
          </el-col>
        </el-row>
      </el-header>
      <el-main style="background-color: RGB(245,245,245)" class="my-main">
        <router-view/>
      </el-main>
    </el-container>
    
    <!-- 返回顶部组件 -->
    <BackToTop :visibility-height="300" :duration="500" :right="30" :bottom="50" />
  </el-container>
</template>

<script setup>
import tools from "@/utils/tools.js";
import {ref} from "vue";
import router from "@/router/index.js";
import {ElMessage} from "element-plus";
import {useRoute} from 'vue-router';
import {HomeOutlined} from "@ant-design/icons-vue";
import {User} from '@element-plus/icons-vue'
import "@/styles/admin.css";
import BackToTop from "@/components/BackToTop.vue";

const isUserLogin = ref(tools.isLogin())
const currentUser = ref(tools.getCurrentUser())
const activeIndex = ref(useRoute().path)

if (currentUser.value === null) {
  window.location.href = "/login"
}
if (currentUser.value && currentUser.value.type === 'USER') {
  router.push({path: "/"})
}

function handleMenuSelect(key, keyPath) {
  activeIndex.value = key
}


function logout() {
  ElMessage({
    message: '退出登录成功，正在跳转',
    type: 'success'
  });
  localStorage.clear()
  router.push({path: "/login"})
}

function editCurrentUser() {
  router.push({path: "/admin/editCurrentUser"})
}

function editPassword() {
  router.push({path: "/admin/editPassword"})
}


const isCollapse = ref(true)

</script>

<style scoped>
.title {
  color: white;
  width: 100%;
  text-align: center;
  margin: 15px 5px;
}
.my-main::-webkit-scrollbar {
  display: none; /* 隐藏滚动条 */
}
.my-aside {
  background-color: #000000;
  overflow-x: hidden;
}

.my-aside::-webkit-scrollbar{
  width: 0px;
}

.el-menu {
  border-right: 0px;
}
</style>

