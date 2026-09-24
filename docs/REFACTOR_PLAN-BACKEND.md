# 后端重构计划(Backend Refactor Plan)

> 依据:`web/aiagant.md`(后端重构与重建 Agent 规范)。
> 状态:**Phase 0 进行中**。已确认的决策与实测基线见下,未经确认不做大规模修改(规范 §28)。
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

> **取证纪律(踩过两次,写下来)**:本项目的校验**分散在多层**——除了 service 里的判空/判角色,
> 还有 **mapper 注解 SQL 的 WHERE 条件**。断言「某处没有校验 X」之前,必须把整条调用链
> (controller → service → mapper SQL)读完。
>
> 反例一:`retrievePassword` 曾被判为「泄漏账号存在性」,实为**先校验验证码**再查用户,不成立。
> 反例二(2026-09-24):`CouponServiceImpl.applyByCode` 曾被判为「不校验 status/expires_at」,
> 实为 **`CouponMapper.selectByCode` 的 WHERE 里带了 `status='enabled' AND expires_at > NOW()`**,
> 过期/下架券根本查不出来,行为本就正确。
> 两次都是**假 finding**,都已撤回。宁可不报,不要错报。

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
- 遗留(未动,属后续阶段):jjwt **0.9.1**、HS256、密钥有**硬编码兜底值**(生产须由 `JWT_SECRET` 注入)、
  无 issuer/audience、**无 refresh、无吊销**(签了 `jti` 但无处存储/校验)。

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

- **无请求 ID / Trace ID / MDC**;实际 `log.*` 调用点仅 3 个类 7 处;无 `logback-spring.xml`;无 Actuator。
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

### Phase 0 — 立闸门 ✅ 进行中

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

### Phase 3 — 契约与错误模型

`ResponseVO` 双写过渡(P2);补 5 个缺失的异常处理器(**每个都要有测试**);`JSONObject`/`Map` 入参换 DTO + `@Valid`;修 `StorefrontCheckoutController:98` 的 NPE;`docs/backend-api.md` 与 `docs/API接口说明.md` 与实际端点对齐 —— 尤其 Phase 1a 后**哪些端点变成默认拒绝**要显式列出。

### Phase 4 — 可维护性

重复暴露收敛(**API 变更,需逐个确认,不擅自删**);空实现端点明确表态(实现或标注为占位);硬编码假数据必须标注;命名统一(URL 变更 → **需前后端联动**,单独阶段且先出映射表)。

### Phase 5 — 可观测性与部署

请求 ID / MDC + `logback-spring.xml`;Actuator(属新增依赖 → **先问**);配置安全(A5);CI(当前完全没有,最小形态是容器内 `mvn -B clean test` + 前端 `npm test` 的闸门脚本,平台需你定)。

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
