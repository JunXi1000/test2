# Routing & Auth Guards

本文档说明项目的路由结构、访问控制与重定向策略，并给出常见问题与调试方式。

## 路由结构（概览）

- 用户站点（DefaultLayout）
  - `/` → Home
  - `/products` → Products
  - `/product/:id` → Product Detail
  - `/cart`、`/checkout`
  - `/login`、`/signup`（guestOnly）
  - `/dashboard`（requiresAuth，role: user）
    - 主页、订单、地址、设置等
- 管理后台（AdminLayout）
  - `/admin/dashboard`（requiresAuth，role: admin）
- 商家后台（MerchantLayout）
  - `/merchant/dashboard`（requiresAuth，role: merchant）
- 其他
  - `/thank-you`
  - `/:pathMatch(.*)*` → NotFound

详细定义参考：`src/router/index.ts`

## meta 规范

- `requiresAuth: boolean`  
  需要登录后访问的页面
- `guestOnly: boolean`  
  游客专用（已登录用户访问将被重定向）
- `role: 'user' | 'admin' | 'merchant'`  
  访问该页面需要的角色

## 守卫逻辑（简述）

守卫文件：`src/router/index.ts`

执行顺序（每次导航）：
1. 读取当前登录态与角色：`useAuthStore()`
2. 获取 meta 聚合结果：
   - `requiresAuth`：任一路由记录含 `requiresAuth`
   - `guestOnly`：任一路由记录含 `guestOnly`
   - `targetRole`：存在 `role` 的那一层路由记录
3. 异常/非法登录态清理：
   - 若 `isAuthed` 但 `role` 缺失或不在允许集合（user/admin/merchant），执行：
     - `sessionStorage.auth_cleared = '1'`
     - `auth.logout()`
     - `next({ name: 'Login', query: { redirect: to.fullPath } })`
4. `guestOnly`：
   - 已登录访问 `guestOnly` 路由 → 按角色重定向：
     - admin → AdminHome
     - merchant → MerchantHome
     - user → DashboardHome
5. `requiresAuth`：
   - 未登录访问 → `next({ name: 'Login', query: { redirect: to.fullPath } })`
6. 角色不匹配：
   - 已登录但 `targetRole !== role` → 将用户重定向到其对应 Home

## 角色落地规则

- user：`/dashboard`
- admin：`/admin/dashboard`
- merchant：`/merchant/dashboard`

## 常见问题与排查

1) 登录后白屏/异常跳转  
- 可能原因：本地存有旧版本/非法登录态  
- 行为：守卫自动清理并跳转到 Login，`sessionStorage.auth_cleared = '1'`  
- Login 页面顶部会显示“已清理旧态”的绿色提示，并有 toast 提示  
- 快速处理（开发环境）：Header 的 “Force Logout（dev only）”，或 Debug 面板 → Clear Auth

2) 无法访问对应后台/用户中心  
- 确认用户角色是否匹配  
- 若角色不匹配，守卫会自动将用户送达其角色可访问的主页

3) 路由变化导致移动菜单未关闭  
- `DefaultLayout.vue` 内已 watch route.path，自动关闭移动菜单

## 调试工具

- 强制退出（开发）
  - 用户站点 Header、Admin/Merchant Header 含 “Force Logout（dev only）”
  - 清理登录态与购物车 → 跳转登录页
  - 显示受 `VITE_FEATURE_DEV_LOGOUT` 控制
- Debug 面板（左下角 Debug 按钮）
  - 清理会话/购物车/全部存储
  - 运行时 Mock 开关（RUNTIME_USE_MOCK）
  - 快速角色登录（User/Admin/Merchant）
  - Checkout 表单预填
  - 注入数据（Cart/Orders/Addresses），含数量可调
  - 自动刷新开关（防止忘记 reload）

## 最佳实践

- 本地开发
  - `.env.local`：`VITE_USE_MOCK=true`，`VITE_FEATURE_DEV_LOGOUT=true`
  - 使用 Debug 面板快速切换 Mock、注入数据与清理会话
- 测试/生产
  - `VITE_USE_MOCK=false`，`VITE_FEATURE_DEV_LOGOUT=false`
  - 依靠守卫自动清理非法登录态
