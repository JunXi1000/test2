-- ============================================================================
-- V10: 商品上架状态(product.status) + 默认收货地址(shipping_address.is_default)
-- 日期: 2026-09-28  (与 Phase 3「商品上下架 / 默认地址去 no-op」配套 / 总控 TASK-000-C Q4)
--
-- ── 一、为什么是现在 ──────────────────────────────────────────────────────
-- 1. product 缺 status 是**数据模型层的结构性缺失**,不是「代码没接」:
--      · entity/Product.java 整个实体没有 status 字段
--      · AdminApiController L288-289 只能硬编码 m.put("status", "active")
--        —— 并附注释「无 status 列时,响应里的 status 只能如实反映『无草稿态』」
--      · L301-306 banProduct 用 setStock(0) 充当下架,而商品列表 L274
--        `productService.page(new HashMap<>(), 1, 100)` **不过滤 stock**,
--        于是被封禁的商品仍在买家列表页可见(REQUIREMENTS-GAP §3.1 同一问题)
--    REQ 3.1「商品上下架」是 P0 需求,库里没有承载它的列,谈不上实现。
--
-- 2. shipping_address 缺 is_default 同理:
--      · StorefrontAddressController L56-60 `PUT /addresses/{id}/default` 是 no-op
--      · 前端 web/src/api/modules/address.ts:7 的 Address 类型有 isDefault:boolean,
--        useCheckoutForm.ts:224 `addresses.find(a => a.isDefault)` 靠它挑默认地址,
--        现在永远挑不出来 → 结算页要用户手选
--
-- ── 二、product.status 的取值(必须与前端契约逐字一致,别自造) ──────────────
--   前端两处声明的并集(web/src/api/modules/adminProducts.ts:9 与
--   merchantProducts.ts:10)就是全部合法值:
--     'active'   已上架 —— 买家列表/详情/结算**只看得到这一档**
--     'draft'    草稿   —— 商家自见,不进买家侧任何列表
--     'archived' 归档   —— 隐藏但保留历史(订单/评价仍指向它)
--     'banned'   封禁   —— 仅 adminProducts.ts 有,对应 DELETE /admin/products/{id}/ban
--   存量行一律落 'active'(DEFAULT),与迁移前「所有商品都可见」的行为**逐字一致**,
--   迁移本身不改变买家侧可见性。
--
-- ── 三、status 一旦存在,哪些既有查询需要按它过滤(后端照此改) ──────────────
--   ⚠️ 本表只是加列;**过滤逻辑是应用层的事**,但加列当天起,
--      不加过滤就会把 draft/archived/banned 的商品继续卖给买家。
--      以下是全仓库所有读 product 的入口,逐个核对:
--
--   A. ProductMapper.queryPage / queryCount(共用 <sql id="queryConditions">,
--      ProductMapper.xml L25-37)—— 这是**最关键的一处**:
--        · StorefrontProductController L61  商品列表     → 必须 status='active'
--        · StorefrontSearchController  L47/L97 搜索/推荐 → 必须 status='active'
--        · StorefrontMerchantController L123/L147 店铺内商品 → 必须 status='active'
--        · MerchantApiController L81(低库存)/L116(商家商品列表)
--             → 商家应看到自己全部四档,**不加过滤**
--        · AdminApiController L274 后台商品列表
--             → 前端已传 status 参数,按传入值过滤(缺省=all 不过滤)
--      建议实现:在 queryConditions 里加一个可选条件
--        <if test="query.status != null and query.status != ''">
--          AND product.status = #{query.status}
--        </if>
--      由各 Controller 决定传不传 —— 不要写死成永远 active,否则后台/商家端会瞎。
--
--   B. ProductMapper.selectById(实体详情)—— 买家侧详情页要先判 status,
--      非 active 应返回 404 而非展示。后台/商家侧的详情不判。
--
--   C. ProductMapper.list() / ProductServiceImpl L60 all() —— 调用方多为
--      StorefrontProductController L117/L154/L177 的「同店相关商品」,
--      这些应改为带 status='active' 的查询。
--
--   D. ProductMapper.salesVolumeTop(size) / salesVolumeTopByShopId(...)
--      (ProductServiceImpl L124/L132;StorefrontMerchantController L88 精选商品)
--      → 都是买家侧推荐,**必须**加 status='active',否则封禁商品会被推荐出去。
--
--   E. ProductMapper.selectTypeCount() / selectTypeCountByShopId()
--      (分类计数看板)→ 是否计入下架商品需产品口径确认;
--      建议**计入**已上架的 active,让看板反映真实在售结构。
--
--   F. StorefrontCheckoutController L58 的 selectById —— 下单前必须判 status,
--      否则仍可下单已下架商品(这一条最容易被漏,它是**成交**路径不是展示路径)。
--
--   G. ShoppingCartServiceImpl L134 / ProductOrderServiceImpl L105 的 selectById
--      —— 从购物车结算时同样要判 status(购物车里可能躺着早已下架的商品)。
--
-- ── 四、索引依据 ──────────────────────────────────────────────────────────
--   idx_shop_status (shop_id, status):商家/店铺列表「按商家 + 按状态」双条件过滤。
--       低基数的 status 单列索引选择性差,复合后才有区分度。
--   idx_status_id  (status, id):后台列表 `WHERE status=? ORDER BY id DESC LIMIT 100`
--       —— 把 id 放进索引第二列,才能同时满足过滤与排序,避免 filesort。
--       (只建 (status) 单列的话,排序仍要额外一步。)
--
-- ── 五、shipping_address.is_default 的约束策略 ───────────────────────────
--   业务不变式是「一个用户至多一个默认地址」。**不在 DB 建唯一键**:
--     · 唯一键需要「非默认行取 NULL」的生成列,MySQL 与 H2 MODE=MySQL 语义要分别验证,
--       且 V4 的既定做法是「DB 约束 + 应用层事务」双保险(见 V4 注释首段),
--       这里沿用同一策略:应用层在事务里先 `UPDATE ... SET is_default=0 WHERE user_id=?`
--       再 `UPDATE ... SET is_default=1 WHERE id=? AND user_id=?`,配  ③ 号索引兜住全表扫。
--     · 若将来要把它下沉到 DB,正确写法是生成列 + 唯一索引,见 03-DATABASE.md §6 的
--       「预留硬化方案」,本期不实施。
--
--   idx_user_default (user_id, is_default):ShippingAddressMapper 目前
--       **对 user_id 完全没有索引**(全库唯一没有索引的过滤列),
--       地址列表与「取默认地址」都走它。
--
-- ── 六、幂等性与执行方式 ──────────────────────────────────────────────────
-- MySQL 8 的 ADD COLUMN / ADD KEY **不可重复执行**(重复执行报 1060/1061/1062)。
--   mysql --default-character-set=utf8mb4 -u<user> -p<pwd> <db> < sql/migrations/V10__product_status_and_default_address.sql
-- 要重跑请先执行 rollback 脚本。
-- 回滚:sql/migrations/rollback/V10__product_status_and_default_address.sql
-- ============================================================================

-- ── 一、product.status ──────────────────────────────────────────────────
-- 取值:active(已上架)/ draft(草稿)/ archived(归档)/ banned(封禁)
-- ⚠️ 与 V8 的 review_status 同理取 NOT NULL DEFAULT 'active' 而非可空:
--    「未设置状态」在本业务里没有意义,而一旦出现 NULL,
--    `WHERE status = 'active'` 会**静默漏掉**这些行 —— 那正是本次要修的缺陷。
--    ADD COLUMN ... NOT NULL DEFAULT 在 MySQL 8 上是纯元数据操作,
--    存量行按 DEFAULT 物化,不改任何现有值,故不构成破坏性变更。
--    (若总控坚持可空,改这一行即可,其余部分不受影响。)
ALTER TABLE `product`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'active'
    COMMENT '上架状态 active=已上架 / draft=草稿 / archived=归档 / banned=封禁' AFTER `sales_volume`;

-- ── 二、shipping_address.is_default ─────────────────────────────────────
-- 0=非默认 / 1=默认。存量行全部为 0,前端 isDefault 拿不到 true 的问题依旧存在,
-- 但列存在后 PUT /addresses/{id}/default 才有可能落库 —— 本迁移**不替应用层补数据**,
-- 默认地址由用户首次点击时确定(更符合真实语义:系统不该替用户猜)。
ALTER TABLE `shipping_address`
  ADD COLUMN `is_default` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '是否默认地址 0=否 / 1=是(一个用户至多一个,不变式由应用层事务保证)' AFTER `user_id`;

-- ── 三、索引 ────────────────────────────────────────────────────────────
-- 商品:商家/店铺列表「按商家 + 按状态」过滤;后台列表「按状态过滤 + 按 id 倒序分页」
ALTER TABLE `product` ADD KEY `idx_shop_status` (`shop_id`, `status`);
ALTER TABLE `product` ADD KEY `idx_status_id` (`status`, `id`);

-- 地址:地址列表(user_id)与取默认地址(user_id, is_default)
ALTER TABLE `shipping_address` ADD KEY `idx_user_default` (`user_id`, `is_default`);

-- ─────────────────────────── 执行后验证 ───────────────────────────
--   SHOW COLUMNS FROM product LIKE 'status';
--     -- 应有 status / 默认 active
--   SELECT COUNT(*) AS total, SUM(status = 'active') AS active_rows FROM product;
--     -- active_rows 应等于 total(存量全部在架,买家侧可见性不变)
--   SHOW COLUMNS FROM shipping_address LIKE 'is_default';
--   SELECT COUNT(*) AS total, SUM(is_default = 1) AS default_rows FROM shipping_address;
--     -- default_rows 应为 0(本迁移不替用户选默认地址)
--   SHOW INDEX FROM product;            -- 应含 idx_shop_status / idx_status_id
--   SHOW INDEX FROM shipping_address;   -- 应含 idx_user_default
-- ⚠️ 迁移完成后,应用层若还没接 status 过滤,买家侧**行为不变**(全部 active);
--    但商家/后台一旦开始写 draft/banned 而查询还没加过滤,
--    下架商品就会重新出现在买家侧 —— 这就是 §三 要求后端同批上线的原因。
-- 再跑一次应用闸门(mvn -B clean test)确认无回归。