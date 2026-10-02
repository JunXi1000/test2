# TASK-000-D1 · 后端聚合实现与 no-op 修复

> 作者：backend Agent · 2026-09-27
> 范围：对既有表（product_order / user / shop / product / product_order_evaluate）做真实 SQL 聚合，
> 替换 admin / merchant / storefront 端返回的硬编码假数据，并修复静默失效的过滤参数。
> **零 schema 变更** —— 本轮没有修改任何 SQL DDL/DML。

---

## 1. 交付总览

| 类别 | 数量 |
|------|------|
| 替换「假数据」的端点 | 10 |
| 修复「参数接收但从不使用」的端点 | 7 |
| 新增文件 | 14（10 VO + 1 Service + 1 ServiceImpl + 1 Mapper + 1 Mapper XML） |
| 修改文件 | 8 |
| 新增端点 | **0**（因此 `AuthzRules` **无任何变更**） |
| SQL schema 变更 | **0** |

### 1.1 `AuthzRules` 变更：无

本轮**没有新增任何端点**，只替换了既有端点的内部实现。
`config/AuthzRules.java` **一行未动** —— 既有的 `/admin/**`→ADMIN、`/merchant/**`→SHOP、
`/products/**`·`/search/**`·`/merchants/**`（白名单）三条规则已覆盖全部改动点。

> Review Gate 核查提示：若 Review Agent 发现本轮「无 AuthzRules 变更」，这是**预期结果**，
> 不是漏登记。要确认的是「改动没有引入新路径」。

---

## 2. 端点级改动清单（含文件:行号）

### 2.1 仪表盘统计（假数据 → 真实聚合）

| 端点 | 改动前 | 改动后 | 位置 |
|------|--------|--------|------|
| `GET /admin/dashboard/stats` | 4 个指标恒为 `"$0"/"0"/"+0%"` | 真实聚合 | `AdminApiController.java:36-43` |
| `GET /admin/dashboard/revenue-chart` | 恒 `Collections.emptyList()` | 按自然日聚合，无订单日补 0 | `AdminApiController.java:63-71` |
| `GET /merchant/dashboard/stats` | 4 个指标恒为 `"$0"/"0"` | 真实聚合（按 token 的 shopId） | `MerchantApiController.java:57-64` |
| `GET /merchants/:id/profile` → `stats` | `rating=4.5`、`satisfactionRate=95` 写死 | 真实聚合 | `StorefrontMerchantController.java:68-71` |
| `GET /merchants/:id/profile` → `featuredProducts` | 恒空列表 | 该店销量前 4 | `StorefrontMerchantController.java:87-89` |
| `GET /admin/merchants` → `revenue` | 恒 `0` | 真实累计销售额 | `AdminApiController.java:163` |

### 2.2 目录 / 搜索

| 端点 | 改动前 | 改动后 | 位置 |
|------|--------|--------|------|
| `GET /products/category-counts` | 每个分类恒 `0`（注释 "Placeholder"） | 真实计数，含 0 件的分类 | `StorefrontProductController.java:79-86` |
| `GET /search/trending` | 硬编码 `Phone/Laptop/Headphones/Watch/Camera` | 销量最高商品名 + 分类名兜底 | `StorefrontSearchController.java:57-64` |
| `POST /search` → `facets` | 恒空 `HashMap` | categories / priceRanges / ratings 真实聚合 | `StorefrontSearchController.java:110-113` |
| `POST /search` → `relatedSearches` | 恒空列表 | 从命中商品标题拆词 | `StorefrontSearchController.java:114-115` |
| `GET /merchants/:id/products` → `categories` | 恒 `List.of("All")` | 该店真实分类 | `StorefrontMerchantController.java:117` |

### 2.3 「不编造数据」硬化（店铺页，最高信任风险）

`StorefrontMerchantController.java`：

| 字段 | 改动前 | 改动后 | 行号 |
|------|--------|--------|------|
| 店铺不存在 | `200` + `{"storeName":"Unknown Store"}` | **`404`** + msg「店铺不存在」 | `:47-52` |
| `stats.rating` | 恒 `4.5` | 真实均值（无评价为 `0.0`，**不是 null 也不是 4.5**） | `:68-71` |
| `stats.satisfactionRate` | 恒 `95` | 真实好评率 | `:68-71` |
| `stats.totalReviews/totalProducts/totalSales` | 恒 `0` | 真实聚合 | `:68-71` |
| `stats.followers` | 恒 `0` | 读 `shop.fans_count` | `:70` |
| `location` | `"Unknown"`（编造） | `""` | `:63` |
| `responseTime` | `"< 1 hour"`（编造） | `""` | `:64` |
| `policies.shipping/returns` | 硬编码英文文案 | `""` | `:77-79` |
| `joinedDate` | `"2024-01"` 兜底 | `""` | `:62` |

> **`rating=4.5` 是本次改动里性质最严重的一处**：它对买家可见，
> 属于用编造的评分做虚假宣传。无数据时返回 0 并让前端隐藏，是唯一诚实的做法。

### 2.4 「参数接收但从不使用」修复

| 端点 | 参数 | 改动前 | 改动后 | 位置 |
|------|------|--------|--------|------|
| `GET /admin/users` | `role` | `if (role != null && !"all".equals(role)) return false;` → **连 `role=user` 都返回空** | `all`/`user`/缺省 → 全部；`admin`/`merchant` → 空集 | `AdminApiController.java:82-127` |
| `GET /admin/orders` | `q` | 完全不用 | 下推 SQL `keyword` 条件 | `AdminApiController.java:274` |
| `GET /admin/products` | `status` | 完全不用 | 接上（见 §5 待 D2） | `AdminApiController.java:243-245` |
| `GET /admin/reviews` | `q` | 完全不用 | 按 id/商品/用户/内容模糊匹配 | `AdminApiController.java:308-312, 339-360` |
| `GET /admin/reviews` | `status` | 完全不用 | 接上（见 §5 待 D2） | `AdminApiController.java:305-307` |
| `GET /merchant/orders` | `q` | 完全不用 | 下推 SQL `keyword` 条件 | `MerchantApiController.java:146` |
| `GET /merchant/products` | `status` | 完全不用 | 接上（见 §5 待 D2） | `MerchantApiController.java:88-91` |
| `GET /merchants/:id/products` | `category` | 接收后**从不放入 query** | 分类名 → id 后真正过滤 | `StorefrontMerchantController.java:103-112` |
| `GET /dashboard/stats` | — | `Pending` 用减法推导 `total - inTransit - completed - cancelled` | 显式按 `待支付` 计数 | `StorefrontDashboardController.java:39-46` |

> 最后一条的隐患：减法推导会把任何**不在那四个枚举里**的状态（如将来的「退款中」）
> 悄悄算成「待付款」。已改为显式计数。

### 2.5 商家订单状态机（新增前置校验）

`MerchantApiController.java:29-42`（转移表）+ `:172-182`（校验）+ `:194-200`（发货不再擦单号）：

| 当前状态 | 允许的目标状态 |
|---------|--------------|
| `待支付` | `processing`、`cancelled` |
| `待发货` | `shipped`、`cancelled` |
| `待收货` | `delivered`、`cancelled` |
| `已完成` | 无（终态） |
| `已取消` | 无（终态） |

- 非法跳转 → **400**，`msg` 带上当前状态与允许的目标状态
- **`cancelled` 不受该表约束**（任何非终态都应允许取消，幂等与退款由 Service 承担）
- 执行顺序：**枚举合法性(400) → 归属校验(403/404, Service 层) → 状态机(400)**
  归属先于状态机，保证越权请求**不泄露**目标订单的当前状态

---

## 3. 新增文件

### 3.1 `mapper/AnalyticsMapper.java` + `resources/mapper/AnalyticsMapper.xml`

只读聚合，横跨 `product_order` / `product` / `user` / `product_order_evaluate` 四张表。
**单独建 mapper 而不塞进既有 mapper**：塞进任何一个都会让那个 mapper 同时承担
「该实体的 CRUD」与「跨表看板」两种职责。既有 `ProductMapper` / `ProductOrderMapper` /
`UserMapper` / `ShopMapper` 一行未动（唯一例外见 §3.3）。

关键 SQL 方法：

| 方法 | 用途 |
|------|------|
| `sumPaidRevenue` / `countPaidOrders` | 营收与订单数（可选 shopId / 时间窗） |
| `sumRevenueByDay` | 收入曲线（`GROUP BY DATE(create_time)`） |
| `sumRevenueByShop` | 管理端商家列表的累计销售额 |
| `countProducts` / `countEnabledUsers` / `countUsersCreatedSince` | 计数 |
| `countDistinctOrderingUsers` | 「Active Now」（见 §4.3） |
| `countByProductType` / `countByPriceBucket` / `countProductsRatedAtLeast` | 搜索分面 |
| `topSellingProductNames` | 热门搜索词 |
| `statShopRating` | 店铺评分聚合 |
| `sumSalesVolume` | 店铺累计销量（件数） |

**「已支付」口径是白名单**（`paidOrderFilter` SQL 片段，全文件唯一一处）：

```sql
AND product_order.status IN ('待发货', '待收货', '已完成')
```

用白名单而非 `NOT IN ('待支付','已取消')` 是刻意的 **fail-closed**：
将来新增任何状态（如「退款中」）都**默认不计入**营收，不会被误算成 GMV。

### 3.2 `service/AnalyticsService.java` + `service/impl/AnalyticsServiceImpl.java`

- 金额全程 `BigDecimal`，任何一步都不下沉到 `float`/`double`；格式化只发生在最后一步
- `shopId` 入参**一律由控制器从 `CurrentUserThreadLocal` 取**，不接受请求参数 → 无横向越权面
- `adminRevenueChart` 补齐没有订单的日期（ECharts 的 category 轴会跳日）
- `percentChange` 在基期为 0 时不返回 `+∞`：本期也为 0 → `+0%`，本期有量 → `+100%`
- `relatedSearches` 刻意**不做随机化**（前端 mock 用 `Math.random()`）：
  同一查询必须给同一结果，否则无法写断言、用户也会看到闪变的推荐

### 3.3 对既有 mapper/service 的**唯一**改动（纯新增方法）

| 文件 | 新增 | 原因 |
|------|------|------|
| `ProductMapper.java:36-38` | `salesVolumeTopByShopId(shopId, size)` | 店铺页 featuredProducts |
| `ProductService.java:31` | 同名方法声明 | |
| `ProductServiceImpl.java:127-134` | 实现 | |
| `ProductOrderMapper.xml:55-63` | `query.keyword` 条件（订单号/商品名/收货人/电话） | 管理端与商家端订单搜索 |

> `salesVolumeTopByShopId` 不能用「全局销量榜再按 shop_id 过滤」代替：
> 那样小店铺永远挤不进全局前 N，`featuredProducts` 恒为空。

### 3.4 新增 VO（10 个）

`StatVO` `RevenuePointVO` `CategoryCountVO` `ShopRatingVO` `ShopRevenueVO`
`PriceRangeCountVO` `PriceBucketCountVO` `RatingCountVO` `SearchFacetsVO` `ShopPublicStatsVO`

全部是前端契约里**已经存在**的形状（`AdminStat` / `RevenueData` / `SearchResults.facets` /
`MerchantPublicProfile.stats`），只是从「Map 手工拼装」变成有类型的类。

---

## 4. 关键口径说明（回答「这个数字到底是什么」）

### 4.1 `Sales` 数的是订单**行**，不是订单**单**

`product_order` 是「一行一商品」的扁平表，同一 `order_no` 有多行。
D1 所有订单计数都是**订单行数**。若看板要显示「订单数（单数）」，
需 `COUNT(DISTINCT order_no)`，且**存量数据 `order_no` 可能为空**，需兜底。
已记入 [04b-SCHEMA-REQUIREMENTS.md](04b-SCHEMA-REQUIREMENTS.md) §7.3。

### 4.2 `Active Users` 的 change 不是存量环比

用户总数的历史快照不可追溯，所以 `value` 给存量（启用用户数），
`change` 给**新注册用户**的环比。文案已在 `AnalyticsServiceImpl` 注释里说明。

### 4.3 `Active Now` 是近似值（如实说明）

库里**没有 session 表、没有 last_login 字段**，登录行为不可观测。
与其编一个「当前在线人数」，不如统计「近 24 小时内有下单行为的去重用户数」。
基数小，change 用**绝对差值**而非百分比。

### 4.4 搜索分面：各维度不应用已选分类

三个维度都**只应用关键字过滤、不应用已选分类**。否则用户一选分类，
其他分类计数全变 0，分面就成了死路。这是标准的 faceted search
（每维用「除自己以外的所有过滤」计数）。

### 4.5 `followers` 是「真实但不完整」

`shop.fans_count` 列存在，D1 直接读它。但**没有任何代码维护它**
（`shop_collect` 的联动逻辑随遗留 CRUD 控制器一起删了），
所以它会长期停留在建表初值 0。这不是假数据，是「没人写的真字段」——
已在 04b §7.1 说明，需产品侧决定是否重建关注功能。

---

## 5. 因缺 schema 而**只做到一半**的部分

以下端点的参数**已经接上**，但因为对应列不存在，域里只有一个取值。
等 database 落地后只需改 WHERE 条件，不需要改接口：

| 端点 | 参数 | 现在的行为 | 缺什么 |
|------|------|-----------|--------|
| `GET /admin/products` | `status` | `active`/缺省 → 全部；`draft`/`archived` → **空集** | `product.status` 列 |
| `GET /merchant/products` | `status` | 同上 | 同上 |
| `GET /admin/reviews` | `status` | `visible`/缺省 → 全部；`hidden` → **空集** | `product_order_evaluate.review_status` 列 |

> 选择「空集」而不是「忽略参数返回全部」：后者会让用户以为筛选生效了。

完整需求见 [04b-SCHEMA-REQUIREMENTS.md](04b-SCHEMA-REQUIREMENTS.md)。

---

## 6. 验证

### 6.1 编译（**本次全量重编，非陈旧产物**）

```
COMPILED_SOURCE_FILES = 153
JAVAC_EXIT_CODE        = 0
ERROR_LINES            = 0
CLASS_FILES_EMITTED    = 161
RESULT = COMPILE OK
```

用 `.m2` 缓存的全部 jar（排除 `-sources`/`-javadoc`）作 classpath，
`javac -encoding UTF-8` 全量编译 `src/main/java`（Lombok 注解处理开启）。
**编译前先 `Remove-Item target\dsh-check -Recurse`**，不复用任何旧 class。

> 本机没有 Maven（`mvn` 不在 PATH），所以用的是 `javac` 直接编译而非 `mvn compile`。
> 两者对**编译正确性**的判定等价，但 `mvn compile` 还会做资源过滤与插件校验，本轮未覆盖。

### 6.2 Mapper XML 良构性

```
MAPPER_XML_COUNT  = 14
MAPPER_XML_VALID  = ALL OK
```

> ⚠️ 本轮**真的踩到过一次**：`AnalyticsMapper.xml` 的价格分桶 SQL 里
> `WHEN product.price < 50 THEN 0` 的 `<` 未转义 → `SAXParseException`，
> Spring 在 context 加载期解析 mapper XML，**139 个测试全挂**。
> 已改为 `&lt;` 并加了一个 XML 良构性校验作为回归手段。
> **后续改任何 `mapper/*.xml` 前请先跑一次 XML 解析校验。**

### 6.3 SQL 在 H2（测试引擎）上的真实执行

把 `src/test/resources/schema-h2.sql` 灌进 H2 `MODE=MySQL`，
逐条执行 D1 新增的全部 25 条 SQL：

```
schema-h2.sql 装载完成
  [OK] sumPaidRevenue 全站       -> 169.00
  [OK] sumPaidRevenue 店铺1      -> 99.00
  [OK] sumPaidRevenue 无匹配     -> 0            ← COALESCE 兜底生效
  [OK] countPaidOrders           -> 2            ← 白名单口径:待支付那单没算进去
  [OK] sumRevenueByDay           -> 2026-10-01, 169.00
  [OK] sumRevenueByShop          -> 1, 99.00 | 2, 70.00
  [OK] countByProductType        -> Electronics, 2 | Clothing, 1
  [OK] countByPriceBucket        -> 1, 3
  [OK] countProductsRatedAtLeast -> 1
  [OK] statShopRating            -> 4.0, 2, 50   ← 均值/条数/好评率
  [OK] statShopRating 无评价      -> null, 0, 0  ← 无评价时 avgRating 为 null(不是 0)
  ... (共 25 条)
全部 SQL 通过
```

关键点：
- `status='待支付'` 的 50.00 **没有**计入营收 → 白名单口径生效
- `DATE(create_time)` 分组在 H2 与 MySQL 下行为一致（测试跑的是真 H2，不是 mock）
- `SUM(...)*100/NULLIF(COUNT(...),0)` 的整数除法在 H2 下返回 50，无除零
- 无匹配时 `COALESCE` 兜底为 0，服务层不需要判空

### 6.4 单元/集成测试

**未运行**（本机无 Maven）。已核对现有 21 个测试类对我改动点的断言：

| 测试 | 影响 |
|------|------|
| `AuthorizationBaselineTest:55` | `GET /merchants/1/profile` → 200。H2 种子有 shop 1 → 仍 200 ✅ |
| `MerchantApiControllerTest:73` | 同上 ✅ |
| `ErrorModelTest:115` | `status="bogus-status"` → 400。现在由 `ALLOWED_TARGET_STATUSES` 提前拦下，仍 400 ✅ |
| `ErrorModelTest:190` | `status` 缺失 → 400 ✅ |
| `ErrorModelTest:202` | 订单 999999 → 404。归属校验在状态机**之前**执行 ✅ |
| `MerchantOrderOwnershipTest:83` | shop1 改 shop2 订单 → 403。`selectById` 先抛 403 ✅ |
| `OrderCancelCharacterizationTest:217` | `status=cancelled`。不受状态机表约束 ✅ |

⚠️ **一处会变红**（见 §7）。

---

## 7. ⚠️ 需要总控裁决：一处行为变更会打破既有测试

**`MerchantOrderOwnershipTest.java:114-121`（`shopCanChangeOwnOrderStatus`）会失败。**

```java
// 该测试造的订单状态是「待支付」,然后 PUT status=shipped,断言 200 且状态变成「待收货」
put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "shipped"))
        .andExpect(status().isOk());                       // ← 我的状态机现在返回 400
assertEquals("待收货", productOrderMapper.selectById(orderId).getStatus());
```

「待支付 → 待收货」在业务上确实非法（未付款就标记已发货），
总控也已明确要求加状态机。但该测试的**本意是验证归属校验**，
用它顺带断言了一个状态机允许的跳转。

- `src/test/**` 写范围属测试 Agent，我**没有**改这个测试
- 该测试的种子数据应改为 `待发货` 状态（归属才是它要验的东西），
  或把目标状态从 `shipped` 换成 `processing`

**请总控指派测试 Agent 调整。** 若裁决为「保留宽松跳转」，
我立即回退状态机表中的 `待支付 → shipped`。

---

## 8. 未做 / 上报总控的事项

### 8.1 上报前端用法问题（我不越界改）

| 问题 | 位置 | 影响 |
|------|------|------|
| 管理端 Users 页角色下拉含 `Merchant` / `Admin`，但 `/admin/users` 只服务 `user` 表 | `web/src/pages/admin/Users.vue:31-34` | 选「Merchant」得空列表；商家管理另有 `Merchants.vue` + `/admin/merchants`，该下拉项冗余 |
| 结算页字段（见 TASK-000-I） | `web/src/pages/Checkout*` | 响应结构变更后需同步 |

### 8.2 需要 D2 / schema 的（本轮明确不做）

见 [04b-SCHEMA-REQUIREMENTS.md](04b-SCHEMA-REQUIREMENTS.md) 与 `docs/backend-api.md` §3。

| 项 | 缺什么 |
|----|--------|
| `/admin/settings` GET/PUT | `admin_setting` 表 |
| `/merchant/settings` PUT | `merchant_setting` 表 |
| `/merchant/wallet*` | `merchant_wallet` / `merchant_wallet_transaction` 表 |
| `PUT /admin/reviews/:id` | `review_status` 列 |
| `PUT /addresses/:id/default` | `shipping_address.is_default` 列 |
| 订单发货快递单号 | `MerchantOrderStatusDTO.trackingNumber` 字段（**非表**，D2 纯 DTO 改动） |
| `banProduct` 语义 | `product.status` 列 |

### 8.3 本轮**刻意没动**的（按总控指示）

- `StorefrontCheckoutController` —— 属 TASK-000-I
- `MerchantApiController` 的 GET/PUT `AccessGuard` —— 归属校验已在
  `ProductOrderServiceImpl.java:75/117-118/197-198/401` 全覆盖，不叠加重复校验
- 任何 SQL schema / 任何 Vue 文件
