# 后端重构计划(Backend Refactor Plan)

> 依据:`docs/aiagant-backend.md`(后端重构与重建 Agent 规范;该文件**不纳入版本库**,
> 只在本地存在,故 clone 后不会有它)。
> 注意别与 `web/aiagant.md` 混淆 —— 那是**前端**规范(`web/CLAUDE.md` 引用它)。
> 状态:**Phase 0–5 全部完成**(2026-09-24 起,2026-09-26 收尾)。各阶段的提交、证据与撤回记录见 §4;
> 实测基线与规模见 §1。当前闸门 **155 个测试全绿**。
> 起始日期:2026-09-24。

---

## 0. 结论

后端**不需要重写**。它的分层是标准的(controller → service → mapper 单向依赖)、mapper SQL 的注入面是干净的、密码与文件上传的既有加固也是对的。

需要修的是**授权模型**与**事务边界**,其余属于结构性改善。按规范 §32 的优先级(安全 → 数据一致性 → 业务正确性 → 契约 → 可维护性 → 可测试性 → 性能 → 简洁)分阶段推进。

### 明确不做的事

- **不翻动 `src/main/resources/mapper/*.xml` 的 SQL** —— 实测 `${` 拼接 0 处、`ORDER BY` 全硬编码、27 处 `LIKE` 全走 `CONCAT('%',#{},'%')`、无 WHERE 1=1 条件塌陷,**注入面本来就是干净的**,动它只有风险没有收益。
- **不引入新依赖、不换 ORM / 框架 / 数据库**(§23);需要时先问。
- **不改前端契约**,唯一例外是已批准的 `ResponseVO` 双写过渡(纯增量)。
- **不做无 benchmark 的性能优化**(§20)。

---

## 1. 实测基线

| 项 | 事实 |
|----|------|
| 构建 | 容器 `nexus-dev`(仓库 bind mount 到 `/workspace`,Maven 3.9.9 + JDK 17);`mvn -B clean test` 通过 |
| 测试 | **108 个测试全绿**,17 个 test set(2026-09-24,Phase 1 后)。基线为 64,Phase 0 后 91 |
| 测试形态 | `@SpringBootTest` + MockMvc + 真 H2(`MODE=MySQL`)+ 真 MyBatis mapper + 真 JWT 签发;`BaseControllerTest` 的 `@Transactional` 逐方法回滚 |
| 规模 | 33 个 Controller / 187 个端点;23 个 Mapper 接口(16 有 XML + 7 纯注解);22 张表 |
| 前端真实调用面 | 遗留 CRUD 里**只调用 4 个**端点:`/shoppingCart/page\|add\|update\|delBatch`;13 个遗留 Controller 的约 80 个端点**前端 0 引用** |
| CI | **不存在** |

---

## 2. 问题清单(按类别,均带证据)

> **取证纪律(踩过三次,写下来)**:
>
> **一、断言「某处没有校验 X」之前,把整条调用链(controller → service → mapper SQL)读完。**
> 本项目的校验分散在多层,除了 service 里的判空/判角色,还有 **mapper 注解 SQL 的 WHERE 条件**。
> - 反例一:`retrievePassword` 曾被判为「泄漏账号存在性」,实为**先校验验证码**再查用户,不成立。
> - 反例二:`CouponServiceImpl.applyByCode` 曾被判为「不校验 status/expires_at」,实为
>   **`CouponMapper.selectByCode` 的 WHERE 里带了 `status='enabled' AND expires_at > NOW()`**。
>
> **二、断言「某段代码能被某个请求到达」之前,也要实测 —— Spring 的 handler/interceptor 顺序反直觉。**
> - 反例三(2026-09-24):曾推断「无 handler 时拦截器不跑,所以 `DELETE /no/such` 会到
>   `NoResourceFoundException`」。实测返回 **401**,因为 Spring 把 `/**` 映射到静态资源处理器时
>   **不限方法**,方法检查在 handler 内部 → `getHandler()` 对任何路径都成功 → **拦截器总有得跑**。
>   结论:`NoResourceFoundException` 只有**白名单路径**才能触发;非白名单的未知路径一律先被
>   默认拒绝挡掉(匿名 401 / 已登录 403)。
>
> **两次假 finding 与一次错误的可达性推断,共同教训:先跑一遍,再下结论。** 宁可不报,不要错报。

### A. 安全

**A1. 授权层是「默认放行」** ✅ **已于 Phase 1a 收口**(改 `AuthzRules` 路径段匹配 + 默认拒绝)

`LoginInterceptor.checkRole` 只对 `/admin`、`/merchant/`、`/user`、`/productOrder` 四个前缀判角色,**其余一律 `return true`**(任意登录用户放行)。另有两处**前缀碰撞**:`startsWith("/admin")` 顺带命中 `/admin-accounts/**`;`startsWith("/productOrder")` 顺带命中 `/productOrderEvaluate/**`。

**A2. 服务层守卫是「不完整」的** ✅ **已随 Phase 1a 一并关闭(相关端点整类默认拒绝)**

| 类别 | 具体 | 后果 |
|------|------|------|
| **一处守卫都没有** | `ProductTypeServiceImpl`、`SlideshowServiceImpl`、`AdvertisingServiceImpl` | **首页轮播与广告位可被任意登录用户改/删**(内容篡改) |
| **`page()` 过滤但 `list()` 不过滤** | `ShippingAddressServiceImpl:43`、`ProductCollectServiceImpl:44`、`ShopCollectServiceImpl`、`ProductBrowsingHistoryServiceImpl` | `/shippingAddress/list` 泄漏**全表收货地址**(姓名/电话/地址属个人信息);其余泄漏他人收藏/关注/浏览历史(行为画像) |
| **`insert()` 判角色但 `updateById()`/`removeByIds()` 不判** | `ProductServiceImpl`、`ShippingAddressServiceImpl:53,61`、`ProductCollectServiceImpl`、`ShopCollectServiceImpl` | 改/删**任意商品**、任意用户地址;`ShopCollectServiceImpl.removeByIds` 还会按传入 `shopId` 做 `fansCount - 1` → **可反复刷低任意店铺粉丝数** |

> **已确认有守卫、不要误报为洞**:`ProductServiceImpl.insert:66`(仅 SHOP,实测 USER → **409**,且 `shopId` 由服务端按 token 覆写)、`ProductCollectServiceImpl.insert:50`、`ShopCollectServiceImpl.insert:55`、`ProductBrowsingHistoryServiceImpl:51`、`ProductOrderEvaluateServiceImpl:55`、各 `page()`、`ShoppingCartServiceImpl` 全部 4 个在用端点。

**A3. 对象级越权(IDOR)—— 逐条复读过源码,以下均确认**

- `ChatServiceImpl.sendMessage`:`conversationId` 来自客户端,`selectById` 命中后**不校验当前用户是否该会话参与者**即插消息;`getMessages` / `markAsRead` 同样不校验 → **任意会话可读可写**。
- `ReturnRequestController.create`:`orderId` 来自请求体**不校验归属**;`refundAmount` 客户端给且**无上限、无服务端重算**;`productTitle` / `productImage` 同为客户编造。
- `ProductOrderEvaluateServiceImpl.insert`:角色守卫**有**(仅 USER),但 `productOrderId` 不校验归属 → **可改写他人订单行的 `order_evaluate_id`**;订单不存在时 `productOrder` 为 null → **NPE → 500**。
- `ShoppingCartServiceImpl.selectById` 与 `createOrder`(后者对 `shoppingCartId` 无归属校验,删除走不带 userId 过滤的 `removeByIds`)。

**A4. 认证面**

- ~~`retrievePassword` 区分「验证码无效」(400)与「手机号不存在」→ 可枚举已注册手机号。~~
  **❌ 此条经复核不成立,已撤销(2026-09-24)**:`UserServiceImpl.retrievePassword` **先校验验证码再查用户**,
  而验证码只发到该手机(`sendResetCode` 走内存态 `ResetCodeStore`,**根本不查库**,对未注册手机号也返回成功),
  攻击者拿不到码就无从枚举。**故未改代码** —— 记录在此以免后人重复"修"一个不存在的问题。
- ✅ **已修**:`ResetCodeStore.verify` 补上失败次数上限(5 次即销毁验证码,必须重发)。此前校验侧可无限次猜测,
  发送侧的 60s/日 10 次限流挡不住猜测;现在两者合起来把 6 位码的暴力面压到「每日 10 次发送 × 5 次尝试」量级。
- ✅ **已修(仅日志)**:`JwtUtils.verifyJwt` 区分「过期」与「校验失败」。此前一律 `catch (Exception)` 吞掉,
  导致「token 过期」与「伪造 token 试探」在日志里长得一样;对外文案与返回(null)不变。
- 遗留(未动,属后续阶段):jjwt **0.9.1**、HS256、无 issuer/audience、**无 refresh、无吊销**。
  ✅ 2026-09-26 更正:**密钥已无硬编码兜底值** —— 仓库内没有任何可用签名密钥;未提供 `JWT_SECRET` 时
  非 prod 生成**一次性随机密钥**(重启后旧 token 失效),prod profile 下缺失直接拒绝启动。

**A5. 配置与凭据**

- **dev 是默认 profile**:SQL 打到 stdout(`log-impl: StdOutImpl`)+ 验证码回显。
- 凭据明文落在仓库:数据源密码默认值、`resetPassword=123456`、compose 的 root 密码、entrypoint 的默认回落。

### B. 数据一致性

**B0.【可凭空造钱,最严重】** `card` 渠道支付的订单被取消时,把退款充进了站内余额钱包,而这笔钱从未被扣过:

```
PaymentServiceImpl.java:65   channel=card → updateStatusByOrderNo(待支付→待发货)  ← 不扣余额(注释自述「模拟银行卡网关,不改余额」)
ProductOrderServiceImpl.java:220-222   取消「待发货」行 → userService.topUp(userId, totalMoney)  ← 往余额加钱
```

`下单 → card 支付 → 取消` 每轮白涨一次订单金额,**可无限重复**(`channel=balance` 支付需要余额,正好用这笔白来的钱)。既有测试用 `card` 但从不取消订单,所以一直没暴露。
**修法有据**:`payment.channel` 已落库(`channel VARCHAR(20) DEFAULT 'card'`),按渠道决定退款去向即可 —— `balance` 才 `topUp`,其余渠道只把支付单置 `已退款`。
**`balance` 渠道路径本身是自洽的**(扣了再加回,净变化为零),所以不是「退款逻辑整体错」,而是**退款去向没按渠道区分**,改动面很小。

**B1. 超时取消订单无事务** —— `cancelTimeoutOrder` 无 `@Transactional`,其调用的 `cancelRows` 跨 4 表写(回补 `product.stock`、退款 `user.balance`、改 `product_order.status`、推进 `payment.status`)。同一条 `cancelRows` 在 `cancelByOrderNo` 下有事务、在这里没有。

**B2. 重复退款竞态** —— `cancelRows` 的幂等判断是「先读行 → 看有无 `待支付`/`待发货` → 逐行退款」,读时**无 `FOR UPDATE`、无条件 UPDATE 兜底**。`OrderTimeoutTask` 每 60s 跑一次,会与用户手动 `cancelByOrderNo` 并发 → 两个执行流可同时读到 `待发货` → **同一笔钱退两次**。DB 层也无约束可拦。

**B3. 多实例必然重复执行** —— 无分布式锁,每实例各自扫描退款(与 B2 叠加)。

**B4. 唯一键缺失 + 「先查后插」** —— `shopping_cart` / `product_collect` / `shop_collect` 无 `(user_id, product_id)` 唯一键;`user.username` / `shop.username` / `admin.username` 无唯一键。基线 `sql/schema.sql` 的 14 张表 **0 外键、0 唯一键、0 二级索引**。

**B5. 金额类型分裂** —— `coupon.value` / `min_order` / `max_discount` / `return_request.refund_amount` 是 **DOUBLE**,而 `user.balance` / `product.price` / `product_order.total_money` / `payment.amount` 是 `DECIMAL(10,2)`;`V2__money_decimal.sql` 只转了后三列。

**B6. 其它** —— `ChatServiceImpl` 全类无事务(`sendMessage` 跨 2 表写 3~4 次);`CouponServiceImpl.claim` 无事务(跨 `user_coupon` + `coupon.claimed`);`selectPendingBefore` 无 LIMIT;`MerchantApiController.updateOrderStatus` 可把状态直接改成 `已取消` 而不回补库存、不退款。

### C. 契约与错误模型

- **`ResponseVO.fail(code, data)` 把原因塞进 `data`,`msg` 硬编码 `"操作失败"`** → 契约层面 `msg` 形同废弃。前端 `http.ts` 已适配(把 `data` 里的原因折进 `e.message`),故**这是既有契约,不能默默改**。
- **异常处理器缺失** → 本应 4xx 的返回 500:`HttpMessageNotReadableException`(畸形 JSON)、`MethodArgumentTypeMismatchException`、`MissingServletRequestParameterException`、`NoResourceFoundException`、`HttpRequestMethodNotSupportedException`。
- **参数校验几乎未触发** —— 全仓 `@Valid` 仅 5 处;14 个遗留 Controller 的 `add`/`update` 全是 `@RequestBody <Entity>` 无 `@Valid`;11 处用 `JSONObject`/`Map<String,Object>` 接参;`UserController` 类级 `@Validated` 空转。
- `StorefrontCheckoutController.java:98` 在 body 缺 `code` 键时 NPE → 500。
- 同一动作多处重复暴露:取消订单 **3 套**、推荐/热销各 2 套、地址 2 套(`/addresses` vs `/shippingAddress` 操作同一实体)。
- 空实现端点返回 `ok()` 但不做事:5 处;硬编码假数据:两端 dashboard stats、`/admin/dashboard/revenue-chart` 空数组、`/merchant/wallet` 返回 0、`POST /admin/merchants` 硬编码 `setPassword("123456")`。
- 命名不一致:camelCase 与 kebab-case 同层混用;`/statisticalReportForms/productTypeProportionOfChar` **拼写缺尾 `t`**。

### D. 数据访问与数据库

- 热查询无索引:`product_order` 的 `user_id`/`shop_id`/`status`/`create_time` 全无索引,而 `selectPendingBefore` 每 60s 按 `status + create_time` 扫。
- 约 30 处注解 SQL 用字面 `SELECT *`;`list()` 类查询**全无 LIMIT**。
- `ShoppingCartMapper.java:32` 把一条 **DELETE 声明为 `@Select`**(MySQL `executeQuery` 不接受无结果集语句);**调用方与是否可达未核实**。
- `updateById`/`insert` 在「全部字段为 null」时生成非法 SQL(`UPDATE t WHERE id=?` / `INSERT INTO t () VALUES ()`),16 个 XML 同构。
- 多个筛选条件用 `!= 0` 判「未传」→ **筛选值 0 被静默丢弃**。
- **H2 测试 DDL 与 MySQL 生产 DDL 是两份独立维护的文件**,一致性仅靠人工(`README.md` 的约定)。
- 无 Flyway/Liquibase,`V*__` 只是命名,迁移由 `docker/entrypoint.sh` 用 marker 文件判首次后 glob 导入 —— **生产如何应用迁移,仓库内无证据**。

### E. 可观测性

- ✅ **已于 Phase 5 修**:~~无请求 ID / Trace ID / MDC;无 `logback-spring.xml`~~ —— 现有
  `config/RequestIdFilter`(每请求 requestId → MDC + `X-Request-Id` 响应头,`finally` 清除)与
  `logback-spring.xml`(日志行含 `%X{requestId}`)。**仍无 Actuator**(按用户决定不引入)。
  实际 `log.*` 调用点仍只有 3 个类 7 处 ✓ 未变。
- `spring.main.allow-circular-references: true` 开着,掩盖循环依赖。
- (对照:prod profile **未**打印 SQL,这点是对的。)

### F. 测试

- **弱断言大量存在**:`AdminApiControllerTest` 10 条里 8 条、`MerchantApiControllerTest` 8/8、`OrderControllerTest` 2/3 只断言 `status().isOk()` + `$.code==200`。
- `TemplateApplicationTests` 方法体为空、零断言。
- **IDOR 行为被测试固化**:`ChatControllerTest` 注释写「works for any ID」并用任意 `conversationId=1` 断言 200。
- 覆盖缺口:**退款路径、并发扣库存、`OrderTimeoutTask`、文件上传、优惠券、退换货、到货订阅、通知偏好** 全无测试。
- `StorefrontPaymentControllerTest` 的库存断言在**同事务内**读自身未提交写 → 不证明并发原子性。

---

## 3. 已确认的决策

| # | 决策 |
|---|------|
| P1 | 遗留 CRUD 端点:**默认拒绝 + 显式放行**(不删端点、URL 与契约不变) |
| P2 | `ResponseVO`:**双写过渡** —— `fail` 同时把原因写进 `msg` 和 `data`,对前端纯增量,之后收敛 |
| P3 | 数据库:**唯一键 + 索引都做**(按 §8 先查重、写迁移与回滚脚本、同步 `schema-h2.sql`) |
| P4 | `pom.xml` 未提交改动:**保留**,并把客观事实补进 `docs/DEVELOPMENT.md` 4.4 节(原始意图未能确认,不替它编理由) |

---

## 4. 分阶段实施

> 每阶段:独立提交 → 跑闸门 → 报告(改了什么/为什么/怎么验证的/风险)。

### Phase 0 — 立闸门 ✅ 已完成(2026-09-24)

照抄前端阶段 3 的成功做法:**先写特性化测试钉住重构前的真实行为,再动代码**。

| 步 | 内容 | 状态 |
|----|------|------|
| 0a | 固化闸门命令(`mvn -B clean test`)与基线(64 绿)写进 `docs/DEVELOPMENT.md` | ✅ |
| 0b | 三个特性化测试类,钉住两条取消路径(含 B0 造钱缺陷的存证)、前端在用的 4 个购物车端点、权限矩阵(「必须保持」/「必须翻转」/「已正确」/IDOR 四段严格分开) | ✅ |
| 0c | pom 改动的 4 条客观事实 + IDE 污染 `target/classes` 的排查方法写进 `docs/DEVELOPMENT.md` | ✅ |

新增测试:`OrderCancelCharacterizationTest`、`ShoppingCartCharacterizationTest`、`AuthorizationBaselineTest`。
**约定**:`AuthorizationBaselineTest` 的 B 段断言的是**当前缺陷**(「授权层没有拦截」),Phase 1 收口后应翻转为 403 —— 这是刻意为之,让修复的 diff 自解释。

### Phase 1 — 安全:授权模型收口 ✅ 已完成(2026-09-24)

闸门:`mvn -B clean test` → **108 个测试全绿**(Phase 0 后为 91)。

**1a. 默认拒绝 + 显式放行** —— 新增 `config/AuthzRules.java`(路径段匹配的规则表),
`LoginInterceptor.checkRole` 改为查表,语义从「未命中即放行」翻转为「未命中即拒绝」。

- **一次改动关闭 90 个端点**(14 个控制器整类关闭 87 个 + 购物车未登记的 3 个),
  占 187 个端点总数的约 48% —— 全部是前端 0 引用的遗留 CRUD。
- **两类问题从机制上消除**:① 前缀误命中(`String.startsWith` → `AntPathMatcher` 路径段匹配,
  `/admin/**` 不再命中 `/admin-accounts`、`/productOrder/**` 不再命中 `/productOrderEvaluate`);
  ② 遗留 CRUD 的读写越权面(A2/A3)整体消失,无需逐个补校验。
- **放行清单的依据**(两条,缺一不可):前端真实调用面 + 既有测试断言的角色语义。
  本次额外做了完备性核查:`api/` 之外**没有任何**裸 `axios`/`fetch` 调用,`api/` 内部只有 `http.ts`
  import axios,故 `api/modules/*` 的路径前缀清单即前端调用全集,逐条都能对上。
- `SpringMvcConfig` 放行 `/error`:拦截器在 handler 解析之后、执行之前运行,若不放行错误转发路径,
  真错误会被变成 403。
- **行为变化(需知晓)**:未知路径现在对已登录用户返回 **403**、对匿名用户 **401**,而非 404 ——
  因为 Spring 的静态资源处理器认领 `/**`,拦截器先于 `NoResourceFoundException` 生效。
  好处是探测者无法区分路径存在与否。

**1b. 对象级校验** —— `ChatServiceImpl` 的 `getMessages`/`markAsRead`/`sendMessage` 补会话归属校验
(会话不存在 404、非参与者 403)。**关键陷阱**:`user` 与 `shop` 是**两套独立 id 空间**(两边都有 id=1),
故必须按角色选要比较的列(`ChatControllerTest.shopParticipantCanReadItsOwnConversation` 是这条的回归网)。
另修 `ChatController.sendMessage` 的**身份伪造**:`senderType` 此前由请求体的 `isMerchant` 布尔决定,
买家传 `isMerchant:true` 即以「店铺」身份发消息;现改为一律取自 token 的 `type`。

**1c. 认证面** —— 见 A4 的两条 ✅(验证码失败计数、JWT 日志区分);一条 ❌ 撤销。

**新增/改动的测试**:`config/AuthzRulesTest`(6,规则表纯单测)、`service/impl/ResetCodeStoreTest`(6)、
`AuthorizationBaselineTest` B 段由「断言当前缺陷」翻转为「断言已收口」、
`ChatControllerTest` 补齐正反例(4 → 10,删掉固化 IDOR 的 "works for any ID" 断言)。

### Phase 2 — 数据一致性 ✅ 已完成(2026-09-24)

**提交**:`62d9932` 代码修复(15 文件) + `bd7de05` schema 与迁移(6 文件)。
**闸门**:`mvn -B clean test` → **121 个测试全绿**(Phase 1 后为 108)。

**三项前置报告(对 `template_v3` 实测,决定迁移做法)**:

| 报告 | 结论 |
| --- | --- |
| **B0 存量影响** | **为零**。`product_order` / `payment` / `shopping_cart` **全 0 行** —— 没有任何 `已退款` 支付记录,那笔「凭空充入的余额」从未在本库发生过(用户余额来自 `schema.sql` 种子)。**无需数据订正** |
| **唯一键查重** | **零重复**。三张关联表 0 行、`user`/`shop`/`admin` 的 username 无重复 → **可直接建约束,无需清理** |
| **金额类型风险评估** | **零行会被舍入**。`coupon.value` / `return_request.refund_amount` 无超 2 位小数的行(`return_request` 本身为空)→ DOUBLE→DECIMAL(10,2) 无精度损失 |
| (附)迁移代价 | 表几乎全空(user 5 / shop 2 / admin 1 / product 3 / coupon 7 / notification 3),执行代价≈0 |

**已完成的代码改动**:

- **2a 重写 `cancelRows`**:① 状态推进改为**条件 UPDATE 抢占行所有权**(新增
  `ProductOrderMapper.updateStatusById`,与既有 `updateStatusByOrderNo` 同构),只有抢到行的
  执行流才回补库存/退款;② **退款按 `payment.channel` 分流** —— 只有 `balance` 渠道才 `topUp` 回余额,
  `card` 等只把支付单置「已退款」。`cancelTimeoutOrder` 补上 `@Transactional`(与 `cancelByOrderNo` 对齐)。
- **2b 补事务**:`ChatServiceImpl.sendMessage`/`markAsRead`、`CouponServiceImpl.claim`。
- **新增 `OrderCancelConcurrencyTest`**:不继承回滚基类(回滚语义下两线程互不可见,构不成竞态),
  真提交 + `JdbcTemplate` 精确还原;注解与基类一致以复用同一 Spring 上下文(H2 种子不幂等,多一个上下文会重复插入)。
  **已做牙齿检查**:把修复暂存后在旧代码上运行,`concurrentCancelTakesEffectOnlyOnce` **如期失败**
  (`balanceAfter > balanceBefore + 50`,即并发退了两笔),而串行重复取消那条通过 —— 与「`anyActive`
  只挡串行、挡不住并发」的缺陷性质完全吻合。
- **`sql/migrations/V4__constraints_and_indexes.sql`**:6 个唯一键 + 13 个索引,含执行前自检查询与
  执行后验证;**回滚脚本刻意放 `sql/migrations/rollback/`** —— `entrypoint.sh` 会 glob 导入
  `sql/migrations/*.sql`,放同级会被当迁移自动执行并撤销。索引清单已按**线上 `information_schema`
  实测**收敛(库里已有 `notification(role,user_id)`、`message` 两个索引等,不重复建)。
- `src/test/resources/schema-h2.sql` 同步这 6 个唯一约束,使测试库与生产库的约束一致(否则测试抓不到重复插入)。

**执行与验证(手工,V4/V5)**:

- 执行前后各跑一次自检:V4 的四类重复、V5 的「会被舍入的行」**全部为 0** → 无需清理数据。
- `V4__constraints_and_indexes.sql` 与 `V5__money_decimal_round2.sql` 已对 `template_v3` 手工执行成功。
- 验证:`information_schema` 显示 `coupon.value/min_order/max_discount`、`return_request.refund_amount`
  四列均为 `decimal(10,2)` 且**可空性与默认值原样保留**;6 个新唯一键与 3 个 `product_order` 新索引就位。
- 迁移后**运行中的应用**健康:登录成功、`/admin/users` 200、`/products` 200,且 Phase 1a 的收口仍在
  (`/slideshow/list`、`/shippingAddress/list` 均为 403)。

**2d 金额类型**(随 `62d9932` 一并提交,未单独成提交 —— 见下方说明):

`coupon.value/min_order/max_discount` 与 `ReturnRequest.refundAmount` 由 `Double` 改为 `BigDecimal`;
`CouponServiceImpl.applyByCode` 改用精确小数运算(`setScale(2, HALF_UP)`),不再用 `Math.round(x*100)/100.0`。
响应形态不变(BigDecimal 序列化为 JSON 数字)。

> **提交拆分说明**:2b(`CouponServiceImpl.claim` 补 `@Transactional`)与 2d(`applyByCode` 改 BigDecimal)
> 落在**同一个文件**且 import 行相邻,不做部分暂存就无法干净拆开;为拆提交而在金额计算方法上反复重写,
> 风险大于收益。故最终按「**代码 / schema**」两分 —— schema 单独一步反而更有价值,因为它有独立的回滚路径
> 且需要手工应用。

**本轮撤回的一条假 finding**:曾判定「`applyByCode` 不校验 `status`/`expires_at`」,实为校验位于
`CouponMapper.selectByCode` 的 `WHERE status='enabled' AND (expires_at IS NULL OR expires_at > NOW())`。
行为本就正确,**未改代码**,只在测试里把这条机制钉住(`StorefrontPromoTest`)。

- **2a. 重写 `cancelRows` 的退款语义与原子性(最高优先,一次改完两件事)**
  - 验收一(B0 造钱):退款去向按 `payment.channel` 分流。
  - 验收二(B1/B2/B3):`cancelTimeoutOrder` 补 `@Transactional`;「读-判-写」改成**原子推进**(条件 UPDATE 抢占行所有权,按影响行数决定是否退款)。**复用已有原语** `ProductOrderMapper.updateStatusByOrderNo`(已存在、返回受影响行数、注释自述「用于幂等推进」,目前只用了 1 次)—— 它按 orderNo **整组**推进,而退款额逐行,故需补「按行 id + 状态守卫」的同构变体。`selectPendingBefore` 加 LIMIT。多实例靠条件 UPDATE 幂等,**不引入分布式锁**。
  - 修完后把 `cardPaidCancelCreatesBalanceOutOfNothing` 从「断言缺陷」翻转为「断言余额不变」;`balancePaidCancelIsNetZero` 必须保持全绿(防改过头的网)。
- **2b. 补事务**:`ChatServiceImpl.sendMessage`/`markAsRead`、`CouponServiceImpl.claim`。
- **2c. 数据库:唯一键 + 索引**(P3):新增 `sql/migrations/V4__*.sql`(沿用命名与 glob 导入顺序),**先查重再建约束**(重复数据需先给你确认),索引按代码实际过滤列补,带**回滚脚本**,**同步 `schema-h2.sql`**。
- **2d. 金额类型**:4 个 DOUBLE 列改 `DECIMAL(10,2)`,Java 侧 `double` → `BigDecimal`(含去掉 `Math.round(x*100)/100.0`)。**单独一个提交**;迁移前 `SELECT` 出会被舍入的行给你确认。
- **2e. 并发测试**:退款并发(只退一次)、并发扣库存(不超卖)、超时任务幂等。需非回滚事务的测试基类(`BaseControllerTest` 的回滚语义测不了并发),**不改既有基类**。

### Phase 3 — 契约与错误模型 ✅ 已完成(2026-09-24)

**提交**:`3787f32` 错误模型(5 个异常处理器 + 双写过渡 + NPE + 文档对齐)、
`d4eda1f` DTO 化批次 A(买家侧 8 端点)、`c3d2fe5` DTO 化批次 B(其余 10 端点 + 2 处 500)。
**闸门**:`mvn -B clean test` → **141 个测试全绿**(Phase 2 后为 123)。

#### 3a `ResponseVO` 双写过渡(P2)

`fail(int code, String message)` —— 原因**同时**写进 `msg` 与 `data`。此前 `msg` 恒为字面量
`"操作失败"`,真实原因只在 `data` 里(前端 `http.ts` 据此折进 `e.message`)。对前端是**纯增量**;
`ErrorModelTest.failWritesReasonToBothFields` 把该契约钉住 —— 将来收敛为「msg 放原因、data 只放业务数据」时
它会失败并提醒同步改前端。
签名从 `Object` 收紧为 `String`:全部 11 处调用本来就传 String,收紧后无需防御分支,且消掉一处 raw type。

#### 3b 补 5 个缺失的异常处理器

`HttpMessageNotReadableException` → 400、`MethodArgumentTypeMismatchException` → 400、
`MissingServletRequestParameterException` → 400、`HttpRequestMethodNotSupportedException` → 405、
`NoResourceFoundException` → 404。**此前一律落入通用 500** —— 把客户端错误报成 500 会让前端与运维都误判。
每一项都有对应测试(否则只是把 500 换成一个未验证的分支)。

#### 3c 参数校验 DTO 化(两批,共 18 个端点 / 15 个 DTO)

**只换入参形态、不加新校验**,因此没有任何"现在能成功"的请求会变成失败。
批次 A = 买家侧 8 个端点;批次 B = 其余 10 个(含唯一跨 service 边界的 `PUT /common/register` ——
连带改了 `CommonService` 接口与 3 个实现)。

**结构改动自带的收益(无需新增规则)**:
- `(String) data.get(...)` 强转全部消失 → 传数字不再 `ClassCastException` → 500;
- `toBool` 的 `Boolean.parseBoolean(String.valueOf(v))` 副作用消失(数字 1 曾得到 `false`,现为 `true`);
- `/checkout/summary` 的 `items` 元素非对象时,从 NPE → 500 变成反序列化失败 → 400;
- 4 个**从不读取 body** 的端点(merchant wallet withdraw/settings、admin review status/settings)
  去掉了无用的入参 —— 它们此前静默丢弃入参却返回 200,前端以为已保存。补实现还是删端点属 Phase 4。

`RequestShapeTest` 钉住两条关键契约:**未知字段被忽略**(前端会多发 `zip`/`price`/`isMerchant` 等,
依赖 Spring Boot 关闭 `FAIL_ON_UNKNOWN_PROPERTIES`)、以及**数字→字符串不再 500**。

#### 3d 文档对齐

`backend-api.md`:§0 重写鉴权(默认拒绝 + 规则表)与错误模型;§2 标注「绝大多数遗留前缀已默认拒绝」并列出
仍放行/已关闭清单;§3 纠正两行已过期说法。
`API接口说明.md` **整体已过期**(仍写着「与 Java 后端不一致、需要网关映射」,而前端早已直连),
故**显式标注为历史文档**并给出权威来源顺序,而不是零散打补丁留一份半真的文档。

#### ✅ 输入校验缺口清单 —— **七项已全部修完**(2026-09-24 记录,2026-09-26 收口)

> 下表是当时的记录。**现在七项都已处理**,不再是待办:
> - #1 `POST /returns` 归属校验 + `refundAmount` 上限 → Phase 4a(`97a4d34`)
> - #2 `promo` 缺 `subtotal`、#3 `chat/messages` 缺 `receiverId`、#4 `stock-alerts` 缺 `productId`
>   → 500 改 400(`20faf92`)。**注:#3 的守卫放在 `ChatServiceImpl` 的 `conversation == null` 分支里,
>   不在控制器** —— 因为已给定存在的 `conversationId` 时 `receiverId` 本就不被使用,无条件要求它会
>   破坏现在能用的调用;`ErrorModelTest.chatExistingConversationDoesNotNeedReceiver` 专门钉住这一点。
> - #5 `POST /admin/merchants` 零校验、#6 `summary` 空 items、#7 未知 `status` → 按常规做法改为明确 400
>   (`0ae9945`);#5 的初始密码也不再硬编码,改走配置项 `resetPassword`。

以下都是"缺少校验"而非"形态"问题,修它们要么属新增约束、要么需前端配合,故**未擅自改**:

| # | 端点 | 缺口 | 后果 |
|---|---|---|---|
| 1 | `POST /returns` | `orderId` 不校验归属;`refundAmount` 由客户端给、无上限、不按订单重算 | 可为**他人订单**伪造退货并虚报金额。**前端该字段是手输文本框、无订单选择器**(`Returns.vue:90` 的 `openReturnForm()` 不传参),补校验会改变用户可见行为 → **需前后端一起改** |
| 2 | `POST /checkout/promo` | `subtotal` 缺失 | NPE → 500(`code` 的同类 NPE 已在 3c 修掉) |
| 3 | `POST /chat/messages` | `receiverId` 缺失 | `conversation.user_id/shop_id` NOT NULL → insert 失败 → 500 |
| 4 | `POST /stock-alerts` | `productId` 缺失 | `stock_alert.product_id` NOT NULL → 500 |
| 5 | `POST /admin/merchants` | **一处校验都没有** | 可建出 name/username/email 全 null 的商家行;且 `username` 直接取 `email`、密码硬编码 `"123456"` |
| 6 | `POST /checkout/summary` | `items` 缺失 | 静默按 `subtotal=0` 返回 200(不报错) |
| 7 | `PUT /merchant/orders/{id}/status` | `status` 为**未知值** | 静默 no-op 返回 200(缺 `status` 已在 3c 改为 400) |

> 其中 #1 是**安全**问题(§32 优先级最高)。但它与前端耦合:前端必须先提供订单选择器,否则用户手输
> (哪怕只是打错)会从「提交成功」变成「报错」。**待用户决策后再动。**

### Phase 4 — 可维护性 ✅ 已完成(2026-09-24)

**提交**:`97a4d34` 退货越权(安全项)、`a9bebb9` 删除 14 个遗留控制器、`a9b96c0` 占位标注与文档纠正。
**闸门**:143 → **143 个测试全绿**(删除前后测试数不变,因为被删端点的断言都是 403,而拦截器的默认拒绝仍生效)。

#### 4a `POST /returns` 越权(§32 最高优先级的安全项)

`orderId` 不再被信任:经新增的 `ProductOrderService.listOwnedOrderRows` 解析并校验归属
(接受 UI 可能展示的三种形态:分组 `orderNo`、`LEGACY-{id}`、纯数字行 id),走与其它订单接口同一套
`AccessGuard` 规则 —— 不存在 404、非本人 403。
`refundAmount` 改为**服务端以订单实付金额为上限**(正数则与实付取小、缺失则取实付):
夹取而非忽略,既让部分退货仍可表达,又使虚报不可能。

> **更正过我先前的一个说法**:我曾说这项"必须前端先加订单选择器才能用"。追查 `orders.ts` 后确认
> **不成立** —— 前端 `id: raw.orderNo`、订单页展示的就是它,用户照抄即可通过校验。只有打错(以前静默成功)
> 与填他人单号(以前也成功)会失败,这正是修复目标。表格里的 `placeholder="e.g. ORD-123456"` 是 mock 数据的
> 形状、后端从未有过,改成"从订单页复制"属体验优化、**非阻塞**。

#### 4b 物理删除 14 个遗留 CRUD 控制器

Phase 1a 已把它们的约 90 个端点从放行表拿掉(403);本轮连同**孤儿 service/mapper/XML/entity** 一并删除:
14 个控制器 + 6 对 service + 5 个 mapper + 5 个 mapper XML + 5 个 entity + 2 处死注入
(`AdminApiController`/`MerchantApiController` 的 `statsService` 只声明未调用)。共 **36 个 Java 文件 + 5 个 XML**,
Controller 33 → **19**。

**保留的"非孤儿"**:`ProductTypeService`(店铺前台分类)、`ShippingAddressService`(`/addresses`)、
`ProductOrderEvaluateService`(管理端评论)、以及 `ProductBrowsingHistoryMapper`/`ProductCollectMapper`
—— 后者虽失去遗留控制器,但 `ProductServiceImpl.recommended()` 用它们算「为你推荐」的个性化权重
(`/products/recommend/{size}` 是前端在用的放行端点)。

> **删除过程中我犯的一个错,值得记下**:我用 `grep "\bProductCollect\b"` 找孤儿,那只匹配**类名**、
> 漏掉了小写字段名 `productCollectMapper`,于是删掉了两个**正在被使用**的 mapper 与两个实体。
> 编译器立刻报 `cannot find symbol`,我用 `git checkout` 恢复并用**大小写不敏感**的 grep 重查了全部被删名字,
> 确认无其它残留。那两个字段现已加注释说明「不要随遗留 CRUD 一起删」。

**外部表现不变**:这些路径现在没有处理器,但请求仍被 `LoginInterceptor` 的默认拒绝挡下(匿名 401 / 已登录 403)。

#### 4c 占位与假数据:**只标注**

`docs/MODULES.md` §2 的占位清单**本来就准确**(我逐条核对过),所以工作是**保持它为真**而非另写一份:
- 纠正了它「已知 Bug」表里一条**假 finding**:`UserServiceImpl.check` 并未写成 `getId() != getId()`,
  当前是**正确**的查重且 `insert`/`updateById` 都调用了它(原记载疑似描述早已被 `aa959c4` 修掉的旧版本)。
  **留在文档里的假 bug 会诱导后人来"修"一个不存在的问题** —— 与我在本次工作中产生过两次假 finding 是同一类陷阱。
- 修掉因 4b 而失真的行(收藏/浏览历史/评价/报表的端点是已删除的;wishlist 两行「未同步」→「已无后端可同步」)。
- 给 admin/merchant 的**仪表盘统计**加代码标注 —— 那两个各 4 项硬编码数字、会被首页当真实指标渲染,是
  最容易被误读的地方。其余站点由 `MODULES.md` 统一覆盖。

#### 4d 命名统一:**无需动作**

原计划里那处拼写缺尾的 URL(`/statisticalReportForms/productTypeProportionOfChar`)**随 4b 的删除消失了** ✓。
其余 camelCase↔kebab 混用都在**前端在用的**路径上(`/common/*`、`/shoppingCart/*`),按用户决策推迟
(改它们需前后端联动),已在计划中保留。

### Phase 5 — 可观测性与部署 ✅ 已完成(2026-09-26)

**提交**:`aef75fc` 请求 ID/日志、`e01e3bf` 配置安全、`0ae9945` + 两条 docs 提交(本地默认值与三项收尾)。
**闸门**:155 个测试全绿。

- **请求 ID / MDC**:新增 `config/RequestIdFilter` —— 用 **Filter 而非拦截器**(拦截器对白名单路径不跑,
  那些请求会没有 id);接受上游 `X-Request-Id`(限长)、否则生成 8 位十六进制;写 MDC 并在 `finally` 清除
  (Tomcat 复用线程,残留会造成日志串号)。`logback-spring.xml` 输出 `%X{requestId}`。
  dev 的 MyBatis 由 `StdOutImpl` 改 `Slf4jImpl`(StdOut 直写 stdout、绕过 logback,拿不到 id 也不受级别控制)。
- **配置安全**:见 §「2.4 配置与密钥」的最终形态 —— **dev 有本地默认值、非 dev 必填**;
  **JWT 密钥仓库内没有任何可用值**(开发生成一次性随机密钥)。
  > ⚠️ **一次被安全审查纠正的设计**:我第一版保留了一把 dev 密钥、用「判断 profile 字符串」当守卫 ——
  > 那是 **fail-open**(`SPRING_PROFILES_ACTIVE` 默认 `dev`,生产忘了设就会用公开密钥签发 token)。
  > 已改为"开发生成随机密钥 + 仓库内无可用密钥",**不要退回 profile 判断那种写法**。
- **Actuator**:**未引入**(属新增依赖,按 §23 先问;用户选择不做)。
- **CI**:**未引入平台**(用户选择只文档化命令 —— 闸门命令见 `docs/DEVELOPMENT.md` §5)。
- **收尾**:另修 `TemplateApplicationTests` 两处隐性问题(它此前跑在 **dev** profile 上、连的是真实开发库;
  补 test profile 后又暴露 `schema-h2.sql` 种子**不幂等**导致的第二上下文冲突 —— 已用与 `BaseControllerTest`
  相同的注解复用单一上下文);以及三处「静默成功」(`/admin/merchants` 零校验、`/checkout/summary` 空 items、
  `/merchant/orders/{id}/status` 未知 status)按常规做法改为明确 400。

---

## 5. 风险与回滚

| 风险 | 缓解 / 回滚 |
|------|-------------|
| Phase 1a 默认拒绝**误伤前端在用端点** | 放行清单逐条依据前端 api 层实测对账生成;改动后跑前端 e2e + 手工过主链路;`git revert` 单提交 |
| Phase 1a 让 ADMIN 失去现存可用的遗留端点 | 跑全量测试确认既有 ADMIN 断言;必要时为 `/productOrder/**`、`/user/**` 显式保留 ADMIN 放行 |
| 建唯一键时**已有重复数据** | 脚本先查重、先给你确认再删;分两步(先查重报告 → 再建约束) |
| `DOUBLE→DECIMAL` **舍入已有值** | 迁移前 SELECT 出会被改动的行给你确认;回滚脚本还原列类型(已舍入的精度不可逆,故先确认) |
| 并发测试需非回滚基类 | 新增独立测试基类,不改既有基类 |
| 改动面过大导致 review 失效 | §22:一次只处理一类变化;命名统一单独阶段且先出映射表 |

---

## 6. 验证方式

```bash
# 后端闸门(容器内,仓库 bind mount 在 /workspace)
docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test'
# 期望:BUILD SUCCESS,0 failed / 0 error

# 后端服务行为(当前已在 :1000 运行;改代码后需重启才生效)
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:1000/
curl -sS -X POST http://localhost:1000/common/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"ADMIN","username":"admin","password":"123456"}'   # 期望 code=200,data 为 JWT
```

后端**不热重载**(`README.md` 明文),改代码后须重启容器内进程才能验证行为。
容器内同时跑着 vite(:5173)与后端(:1000),与本重构共用容器。
