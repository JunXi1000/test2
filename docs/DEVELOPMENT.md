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

1. **数据库**:建库 `template_v3`。`sql/` 下脚本按需导入:`sql/schema.sql`(基础表+演示种子,含 admin 账号)、`sql/chat.sql`(聊天表)、`sql/migrations/` + `sql/migration-2026-08-08-phase1.sql`(增量迁移)。
2. **后端**:IDEA 打开项目根 → 运行 `com.project.platform.ProjectManagement`;或在 `src/main/resources/application.yaml` 改好 DB 连接后 `mvn spring-boot:run`。
3. **前端**:
   ```bash
   cd web
   npm install
   npm run dev        # 起在 :5173,代理 /api → :1000
   ```

演示账号(密码均 `123456`):管理员 `admin` / 买家 `user1` / 商家 `shop1`。

### 2.4 配置与密钥

**默认即可跑**(2026-09-26 起):`application-dev.yaml` 与 `docker-compose.yml` 都带**本地默认值**,
clone 下来 `docker compose up -d` 就能跑,不必先配环境变量。

**生产必须显式配置**,靠 profile 而不是靠"改默认值"来区分:

| 变量 | dev 默认 | 生产 |
|------|----------|------|
| `SPRING_DATASOURCE_PASSWORD` | `123456`(dev profile 内) | **必填**,基配置无默认值 → 缺了启动失败 |
| `RESET_PASSWORD` | `123456`(dev profile 内) | **必填**,同上 |
| `MYSQL_ROOT_PASSWORD` | `123456`(compose) | 必填 |
| `SPRING_PROFILES_ACTIVE` | `dev`(compose 显式设置) | **必须设为 `prod`** |
| `JWT_SECRET` | 不设则**生成本次运行的随机密钥** | **必填**,prod profile 下缺失直接启动失败 |

> ⚠️ **生产必须设 `SPRING_PROFILES_ACTIVE=prod`** —— 否则会落到 dev 的本地弱口令上。
> 本应用只有 `dev` / `prod` 两个 profile。

**JWT 密钥为什么没有仓库内的默认值**:仓库里的固定密钥等于公开,任何人都能拿它伪造任意用户的 token。
所以这里**不放任何可用密钥**:开发时**生成本次运行的一次性随机密钥**(代价:重启后旧 token 失效,
前端会按 401 跳登录,属预期);生产必须注入 `JWT_SECRET`。
> 注意:曾一度用"保留 dev 密钥 + 判断 profile 字符串"的做法 —— 那是 **fail-open** 的
> (忘了设 profile 就会用上公开密钥),**不要退回那种写法**。

覆盖方式:`cp docker/.env.example docker/.env` 填好后重建容器(`docker compose up -d`;`restart` 不生效)。

> 测试不受影响:口令与 `resetPassword` 由 `application-test.yaml` 覆盖,`jwt.secret` 由
> `BaseControllerTest` 的静态块提供(用 System property 而非环境变量,不污染容器环境)。

> 注:`sql/migrations/V1__security.sql` 里出现明文 `'123456'` 是**迁移的匹配条件**
> (它按该值找出旧行改成 BCrypt),不是配置兜底,无法移除。

## 3. Mock 开关机制(务必理解)

```ts
// web/src/config/env.ts
USE_MOCK = localStorage.RUNTIME_USE_MOCK ?? (import.meta.env.VITE_USE_MOCK === 'true')
```

- **构建时**:`.env` 默认 `VITE_USE_MOCK=false`,前端默认走真实后端。
- **运行时覆盖**:浏览器控制台 `localStorage.RUNTIME_USE_MOCK='true'` 后刷新,即切 mock(无需重建)。
- **生产构建已不是 mock**(自 `c528a5a` / 2026-08-24 起):`.env.production` 只设 `VITE_API_BASE_URL=/api`,不覆盖 `VITE_USE_MOCK`;
  但 Vite 在 `--mode production` 下**仍会加载 `.env`**,故 `npm run build-prod` 产物读到的 `VITE_USE_MOCK=false`。
  要临时打一个带 mock 的产物,才需显式加 `VITE_USE_MOCK=true`。(旧记载「产物默认 mock=true、需显式关」已作废。)
- **模块差异**:部分模块(admin*/merchant* 系列)读取响应式 `RUNTIME_USE_MOCK.value`,切换立即生效;其余模块用 `import` 时的常量 `USE_MOCK`,切换需刷新页面。
- **聊天 mock 已补齐**:`web/src/api/modules/chat.ts` 已加 mock 分支。⚠️ 若在 **mock 模式下登录**,后端签发的 token 是假的,任何**未加 mock 分支**的真实请求会 401 → 全局拦截器清会话跳登录 → 死循环。新增模块务必保留 mock 兜底。

## 4. 代码规范

### 4.1 后端(Spring Boot + MyBatis)

- **分层**:controller → service(接口 + impl)→ mapper(接口 + XML)。单向依赖,禁止 controller 直连 mapper。
- **Entity**:纯 POJO,不用 Lombok,手写 getter/setter;关联字段(如 `productTypeName`、`shopName`)直接加在实体上。
- **Mapper**:每个表一对接口 + XML。常规 CRUD 沿用模板方法名 `queryPage / queryCount / selectById / list / insert / updateById / removeByIds`;复杂查询在 XML 写动态 SQL,简单查询可用 `@Select`。
- **响应**:统一 `ResponseVO<T>`(code=200 成功,msg,data);分页用 `PageVO<T>`(list,total)。参数校验用 Bean Validation(`@NotBlank` 等),自定义异常抛 `CustomException`(默认 HTTP 409)。
- **鉴权**:新端点默认受拦截。**授权是「默认拒绝 + 显式放行」**——公开接口在 `config/SpringMvcConfig.java` 的 `excludePathPatterns` 声明(那些路径根本不进拦截器),其余一律要在 `config/AuthzRules.java` 的规则表里登记「路径 → 允许角色」,**未登记的路径对所有角色一律 403**。
  - 规则表用 `AntPathMatcher` 做**路径段**匹配,所以 `/admin/**` 不会命中 `/admin-accounts`(旧实现用 `String.startsWith`,曾因此误门控两个无关控制器)。
  - 加新端点时必须同时登记规则,否则前端会拿到 403。登记前先核对两处:① 前端真实调用面(`web/src/api/modules/*.ts` 与各域页面 import 的模块);② 既有测试断言的角色语义。
  - 放行清单的回归网:`config/AuthzRulesTest`(规则表纯单测)与 `controller/AuthorizationBaselineTest`(端起端到端);两者分工是「规则表说放不放」与「拦截器真的照做了」。
  - 行为须知:未知路径对已登录用户返回 **403**、对匿名用户 **401**,而不是 404 —— 拦截先于 `NoResourceFoundException` 生效。好处是探测者无法区分路径存在与否。
- **前端路径对齐**:面向前端页面的新端点放**门面控制器**(`Storefront*` / `AdminApi` / `MerchantApi`),路径与 `web/src/api/modules/*.ts` 一一对应;传统 CRUD 放传统控制器。
- **服务层守卫必须「成对写」**:现有代码存在系统性遗漏——同一个 service 里 `page()` 按 `userId` 过滤,而 **`list()` 完全不过滤**;`insert()` 判角色,而 **`updateById()`/`removeByIds()` 不判**。`ProductTypeServiceImpl` / `ShopServiceImpl` 甚至一处守卫都没有(前者 `check()` 是空方法)。(原先同时点名的 `SlideshowServiceImpl` / `AdvertisingServiceImpl` 已随其控制器物理删除,问题不复存在。)新增/修改遗留 CRUD 时,**读方法要给 `list()` 也加过滤,写方法要逐个判角色或归属**,不要只加在 `page()`/`insert()` 上。

### 4.4 依赖与构建(已知偏差)

`pom.xml` 里有两行**偏离 Spring Boot 托管版本**的改动,于 2026-09-24 未提交状态下存在于工作区。客观事实如下,**原始意图未能从代码确认**:

| 项 | 事实 |
|----|------|
| 改动内容 | 把 `mockito.version` 从 Spring Boot 3.2.10 托管的 `5.7.0`(`spring-boot-dependencies-3.2.10.pom` 第 144 行)覆盖为 `5.11.0`;并新增依赖 `org.mockito:mockito-subclass:5.11.0` |
| 代码里的理由 | 注释写「新增:强制指定高版本依赖,解决 JDK 兼容性问题」 |
| 实际使用情况 | **全项目测试代码没有使用 Mockito**(无 `@MockBean`、无 `Mockito` 调用);测试形态是 `@SpringBootTest` + 真 H2 + 真 mapper |
| 副作用 | 这两个坐标未进 `.m2` 缓存时,**离线构建失败**(报 `org.mockito:mockito-bom:pom:5.11.0 (absent)`)。联网构建一次后写入持久化的 `.m2` volume,之后可离线构建 |

> 处理约定:保留现状但**不要**在此基础上继续调整版本;若后续要动,按「说明原因 / 收益 / 风险 / 影响范围 / 迁移成本 / 回滚方案」报备后再改。


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
  # 闸门命令(容器内;仓库 bind mount 在 /workspace)
  docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test'

  # 只跑某几个测试类
  docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test -Dtest=SomeTest -DfailIfNoSpecifiedTests=false'
  ```
  **必须带 `clean`**,原因见「常见问题」里 IDE 污染 `target/classes` 那条。
  **跑闸门之前必须先停掉容器内的 dev 后端**,否则 `maven-clean-plugin` 删不掉被运行中的 JVM
  占用的 `target/`(报 `Failed to clean project: Failed to delete /workspace/target`):
  ```bash
  docker exec nexus-dev bash -lc 'pkill -f "[s]pring-boot:run"; pkill -f "[P]rojectManagement"'
  # 跑完闸门后再拉起来
  docker exec -d nexus-dev bash -lc 'cd /workspace && setsid nohup mvn spring-boot:run > /var/log/backend.log 2>&1 < /dev/null &'
  ```
  (`pkill` 的匹配串要用中括号写法,否则会匹配到 `pkill` 自己所在的命令行 —— 见「常见问题」。)
  若报 `Failed to delete /workspace/target` 但**确认没有后端在跑**,那是**瞬时占用**:本仓库位于
  OneDrive 同步目录下,同步客户端会去扫 `target/` 并短暂持有文件句柄。**重试即可**;
  反复出现可把 `target/` 排除出 OneDrive 同步。
  2026-09-24 建立的**起点基线**是 64 个测试全绿(11 个 test set);当前(2026-09-26)为
  **155 个 `@Test` / 21 个测试类**。另有三个**特性化测试**类用于钉住重构前行为(见
  `docs/REFACTOR_PLAN-BACKEND.md`):`OrderCancelCharacterizationTest`、`ShoppingCartCharacterizationTest`、
  `AuthorizationBaselineTest`。其中 `AuthorizationBaselineTest` 的 B 段**已完成翻转**:它现在断言的是
  「已删除/未登记的遗留端点仍被默认拒绝」—— 14 个遗留控制器已物理删除,这些路径没有处理器,
  但 `LoginInterceptor` 的默认拒绝仍先一步挡下(匿名 401 / 已登录 403),故断言一字未改仍然成立。
- **前端**:目前无单测脚本;`web/tests/*.spec.ts` 为 Playwright 端到端(可选择性运行)。改动页面建议手动验证:`npm run dev` + 控制台切 `RUNTIME_USE_MOCK`。

## 6. 数据库 schema 维护约定

| 场景 | 做法 |
|------|------|
| 新增表(正式环境) | 新建/追加一份增量 SQL 到 `sql/migrations/`,对已初始化的库执行 |
| 新增表(测试) | 同步追加到 `src/test/resources/schema-h2.sql` |
| 种子数据 | 写入增量 SQL,保持可重复执行(如 INSERT IGNORE / DELETE 守卫) |
| 回滚脚本 | 放 **`sql/migrations/rollback/`** 子目录,不要与迁移同级 |

### 6.1 迁移怎么应用到**已存在的库**(重要)

`docker/entrypoint.sh` **只在首次建库时**导入 `sql/migrations/*.sql`(靠 `${DATA_DIR}/.schema-imported`
标记文件判断,**该文件在 MySQL 数据卷里,容器重建后依然存在**),所以**新增的迁移对已有库不会自动生效,必须手工执行**:

```bash
# 容器内执行(口令取自容器环境变量,不回显)
docker exec nexus-dev bash -lc '
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 \
    template_v3 < /workspace/sql/migrations/V4__constraints_and_indexes.sql'

# 回滚
docker exec nexus-dev bash -lc '
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 \
    template_v3 < /workspace/sql/migrations/rollback/V4__constraints_and_indexes.sql'
```

- **必须带 `--default-character-set=utf8mb4`**,否则含中文的脚本会被双重编码(见「常见问题」)。
- ⚠️ **回滚脚本必须放 `rollback/` 子目录**:`entrypoint.sh` 会 glob 导入
  `sql/migrations/*.sql`(非递归),回滚脚本若与迁移同级,会在首次建库时被当成迁移自动执行,
  把刚建好的约束立刻删掉。
- MySQL 8 的 `CREATE INDEX` **没有** `IF NOT EXISTS`,所以迁移脚本默认**不可重复执行**;
  要重跑先执行回滚脚本,或把脚本写成 `information_schema` 先查后建的形式。
- 涉及唯一键的迁移,**执行前必须先查重**(脚本里应自带自检查询);本仓库 `V4` 的查重结果
  是「零重复,无需清理」,但那是对当时的 `template_v3` 而言,换库要重跑自检。

## 7. 常见问题

| 症状 | 原因 / 处理 |
|------|-------------|
| 消息页报错 | 聊天**已有** mock 兜底(`web/src/api/modules/chat.ts` 读 `USE_MOCK`,四处分支)。仅在「mock 关闭 + 后端未启动」时才会真报错 —— 先确认后端在线 |
| 生产构建出来是假数据 | 自 `c528a5a` 起 `.env` 已设 `VITE_USE_MOCK=false`,产物默认**不是** mock。仍见假数据时按序排查:`.env.production.local` / 手改的 `.env` 是否覆盖、浏览器 `localStorage.RUNTIME_USE_MOCK` 是否残留 `'true'`、构建缓存是否陈旧 |
| 登录后白屏/被踢回登录页 | 旧会话失效,`sessionStorage.auth_cleared=1` 触发;重新登录 |
| 结算成功但订单列表没有 | mock 关闭后订单只存在于服务端;Phase 2 修复前属预期 |
| 改了后端不生效 | 本地需重启 Spring Boot |
| 本机 MySQL 端口冲突 | 改 `application.yaml` 中 datasource 端口,或换用另一实例 |
| 迁移 SQL 中文变乱码 | 导入含中文的 SQL 必须加 `--default-character-set=utf8mb4`;mysql CLI 默认 latin1,会把 UTF-8 字节双重编码入库 |
| 构建报 `cannot find symbol: method setId(...)`,且指向 Lombok 类的 getter/setter | **IDE 污染了 `target/classes`**。本机 IDE 的 Lombok 注解处理器会崩(`NoClassDefFoundError: lombok.javac.Javac`),但仍把**不含 Lombok 生成方法**的 class 写进 `target/classes`;这些 class 比源码新,Maven 增量编译据此判定「已最新」而不重编。判别式:`javap -p target/classes/.../X.class \| grep -c getXxx` 为 0 即被污染。处理:`mvn clean test` 重来,并**不要去改源码**。同时,IDE 里大量主源码「错误」(`PageVO.getList()` undefined 等)是同一个原因造成的**假报错**,以 Maven 结果为准 |
| 离线构建失败 `mockito-bom:pom:5.11.0 (absent)` | `pom.xml` 覆盖了 Spring Boot 托管的 mockito 版本,见 4.4 节。联网构建一次即写入 `.m2` 缓存,之后可离线 |
