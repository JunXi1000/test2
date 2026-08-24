# 开发指南与规范

> 新加入项目从这里开始:启动环境、mock 机制、代码规范、测试策略、常见坑。

## 1. 环境准备

| 依赖 | 版本 | 说明 |
|------|------|------|
| JDK | 17+ | 后端编译运行 |
| Maven | 3.6+ | 后端构建 |
| Node.js | 18+ | 前端构建(Vite 5 要求) |
| MySQL | 8.0+ | 数据库(本地开发) |

## 2. 启动

### 2.1 本地开发

1. **数据库**:建库 `template_v3`。`sql/` 下脚本按需导入:`sql/templatev3_s.sql`(仅 admin 表,已过时)、`sql/chat.sql`(聊天表)、`sql/migrations/` + `sql/migration-2026-08-08-phase1.sql`(增量迁移)。
2. **后端**:IDEA 打开项目根 → 运行 `com.project.platform.ProjectManagement`;或在 `src/main/resources/application.yaml` 改好 DB 连接后 `mvn spring-boot:run`。
3. **前端**:
   ```bash
   cd web
   npm install
   npm run dev        # 起在 :5173,代理 /api → :1000
   ```

演示账号(密码均 `123456`):管理员 `admin` / 买家 `user1` / 商家 `shop1`。

## 3. Mock 开关机制(务必理解)

```ts
// web/src/config/env.ts
USE_MOCK = localStorage.RUNTIME_USE_MOCK ?? (import.meta.env.VITE_USE_MOCK === 'true')
```

- **构建时**:`.env` 默认 `VITE_USE_MOCK=true`,前端默认 mock。
- **运行时覆盖**:浏览器控制台 `localStorage.RUNTIME_USE_MOCK='false'` 后刷新,即切真实后端(无需重建)。
- **生产构建陷阱**:`.env.production` 未覆盖 `VITE_USE_MOCK`,故 `npm run build-prod` 产物默认仍是 mock=true。要生产关 mock,需在 `.env.production` 显式加 `VITE_USE_MOCK=false`。
- **模块差异**:部分模块(admin*/merchant* 系列)读取响应式 `RUNTIME_USE_MOCK.value`,切换立即生效;其余模块用 `import` 时的常量 `USE_MOCK`,切换需刷新页面。
- **聊天 mock 已补齐**:`web/src/api/modules/chat.ts` 已加 mock 分支。⚠️ 若在 **mock 模式下登录**,后端签发的 token 是假的,任何**未加 mock 分支**的真实请求会 401 → 全局拦截器清会话跳登录 → 死循环。新增模块务必保留 mock 兜底。

## 4. 代码规范

### 4.1 后端(Spring Boot + MyBatis)

- **分层**:controller → service(接口 + impl)→ mapper(接口 + XML)。单向依赖,禁止 controller 直连 mapper。
- **Entity**:纯 POJO,不用 Lombok,手写 getter/setter;关联字段(如 `productTypeName`、`shopName`)直接加在实体上。
- **Mapper**:每个表一对接口 + XML。常规 CRUD 沿用模板方法名 `queryPage / queryCount / selectById / list / insert / updateById / removeByIds`;复杂查询在 XML 写动态 SQL,简单查询可用 `@Select`。
- **响应**:统一 `ResponseVO<T>`(code=200 成功,msg,data);分页用 `PageVO<T>`(list,total)。参数校验用 Bean Validation(`@NotBlank` 等),自定义异常抛 `CustomException`(默认 HTTP 409)。
- **鉴权**:新端点默认受拦截;公开接口在 `config/SpringMvcConfig.java` 白名单显式声明。角色敏感接口在 `LoginInterceptor.checkRole` 增加前缀分支。
- **前端路径对齐**:面向前端页面的新端点放**门面控制器**(`Storefront*` / `AdminApi` / `MerchantApi`),路径与 `web/src/api/modules/*.ts` 一一对应;传统 CRUD 放传统控制器。

### 4.2 前端(Vue 3 + TS)

- **API 模块**:每模块一个 `web/src/api/modules/*.ts`,统一「mock 分支 + 真实分支」,函数签名返回 `Promise<T>`,类型定义在文件内 export。
- **状态**:跨组件共享用 Pinia store;仅本地缓存用 store + localStorage。新增 store 需接入 `stores/userScope.ts` 的 `scopedKey`(按登录用户隔离)与 `onUserScopeChange`(登入/登出重载)。
- **页面**:Composition API + `<script setup>`;路由在 `router/index.ts` 懒加载注册,受保护页加 `meta: { requiresAuth, role }`。
- **UI**:优先使用 `src/components/ui/` 自研组件;Element Plus 组件由 unplugin 自动按需引入,无需手动 import。
- **新模块保留 mock 分支**:在真实后端稳定前,新接口务必提供可用的 mock 兜底,避免依赖后端的页面白屏。

### 4.3 Git

- 常规分支命名:`feat/xxx`、`fix/xxx`、`docs/xxx`。
- 提交信息:中文或英文均可,一句话说清改动 + 动机。
- 每阶段结束可提交一次,保持工作区干净再进入下一阶段。

## 5. 测试策略

- **后端**:`src/test/java/.../controller/` 下 MockMvc 冒烟测试(基于 `BaseControllerTest`,H2 `MODE=MySQL` 内存库,自动生成 ADMIN/USER/SHOP 的 JWT)。新增表必须同步 `src/test/resources/schema-h2.sql`,否则测试报表不存在。
  ```bash
  mvn test
  ```
- **前端**:目前无单测脚本;`web/tests/*.spec.ts` 为 Playwright 端到端(可选择性运行)。改动页面建议手动验证:`npm run dev` + 控制台切 `RUNTIME_USE_MOCK`。

## 6. 数据库 schema 维护约定

| 场景 | 做法 |
|------|------|
| 新增表(正式环境) | 新建/追加一份增量 SQL 到 `sql/migrations/`,对已初始化的库执行 |
| 新增表(测试) | 同步追加到 `src/test/resources/schema-h2.sql` |
| 种子数据 | 写入增量 SQL,保持可重复执行(如 INSERT IGNORE / DELETE 守卫) |

## 7. 常见问题

| 症状 | 原因 / 处理 |
|------|-------------|
| 消息页报错 | 聊天无 mock,需后端在线 |
| 生产构建出来是假数据 | `.env.production` 缺 `VITE_USE_MOCK=false` |
| 登录后白屏/被踢回登录页 | 旧会话失效,`sessionStorage.auth_cleared=1` 触发;重新登录 |
| 结算成功但订单列表没有 | mock 关闭后订单只存在于服务端;Phase 2 修复前属预期 |
| 改了后端不生效 | 本地需重启 Spring Boot |
| 本机 MySQL 端口冲突 | 改 `application.yaml` 中 datasource 端口,或换用另一实例 |
| 迁移 SQL 中文变乱码 | 导入含中文的 SQL 必须加 `--default-character-set=utf8mb4`;mysql CLI 默认 latin1,会把 UTF-8 字节双重编码入库 |
