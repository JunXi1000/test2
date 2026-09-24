-- ============================================================================
-- V4: 唯一约束 + 缺失索引
--
-- 背景(为什么现在做):
--   1. 基线 sql/schema.sql 的 14 张表**0 唯一键、0 二级索引**;唯一的键都散落在
--      后续增量脚本里(见下「已存在」清单)。
--   2. 应用层多处是「先查后插」(shopping_cart / product_collect / shop_collect
--      的 insert、注册时的 username 查重),并发下没有 DB 约束兜底会产生重复行。
--      数据库约束与应用层校验必须共同保证数据正确性。
--   3. product_order 的 user_id / shop_id / status 全无索引,而 OrderTimeoutTask
--      每 60s 按 status + create_time 扫一次该表。
--
-- 执行前的查重结果(2026-09-24,对 template_v3 实测):
--   shopping_cart / product_collect / shop_collect 均 0 行,username 无重复,
--   coupon.value 与 return_request.refund_amount 无超 2 位小数的行 —— **无需清理数据**。
--   注意:换库执行前请重跑脚本末尾的「执行前自检」查询,有重复行时会报 1062 失败。
--
-- 应用方式:**手工执行**(当前 docker/entrypoint.sh 只在首次建库时导入 migrations/,
--   已有库不会自动应用)。命令见 docs/DEVELOPMENT.md「数据库 schema 维护约定」。
--   ⚠️ 回滚脚本刻意放在 sql/migrations/rollback/,因为 entrypoint.sh 会 glob
--   导入 sql/migrations/*.sql —— 放同级会被当成迁移自动执行并撤销本迁移。
--
-- 幂等性:MySQL 8 不支持 CREATE INDEX IF NOT EXISTS,故本脚本**不可重复执行**
--   (重复执行会因索引已存在而报 1061)。需要重跑请先执行 rollback 脚本。
-- ============================================================================

-- ─────────────────────────── 一、唯一约束 ───────────────────────────
-- 「先查后插」的并发兜底:撞唯一键会抛异常,配合应用层事务一起回滚

-- 购物车:同一用户同一商品只应有一行(应用层 ShoppingCartServiceImpl.insert 会累加数量)
ALTER TABLE shopping_cart
  ADD UNIQUE KEY uk_user_product (user_id, product_id);

-- 商品收藏
ALTER TABLE product_collect
  ADD UNIQUE KEY uk_user_product (user_id, product_id);

-- 店铺关注
ALTER TABLE shop_collect
  ADD UNIQUE KEY uk_user_shop (user_id, shop_id);

-- 登录标识:三张账号表的 username 此前无唯一键,重复注册只靠应用层「先查后写」挡
ALTER TABLE user  ADD UNIQUE KEY uk_username (username);
ALTER TABLE shop  ADD UNIQUE KEY uk_username (username);
ALTER TABLE admin ADD UNIQUE KEY uk_username (username);

-- ─────────────────────────── 二、缺失索引 ───────────────────────────
-- 只补代码里真实过滤/排序的列;已存在的索引见文件末尾清单,不要重复建

-- 订单:OrderTimeoutTask 每 60s 按 (status, create_time) 扫;后台/前台列表按 user_id、shop_id 过滤
ALTER TABLE product_order ADD KEY idx_user_id (user_id);
ALTER TABLE product_order ADD KEY idx_shop_id (shop_id);
ALTER TABLE product_order ADD KEY idx_status_create_time (status, create_time);

-- 商品:MerchantApiController 与 StorefrontProductController 按 shop_id / product_type_id 过滤
ALTER TABLE product ADD KEY idx_shop_id (shop_id);
ALTER TABLE product ADD KEY idx_product_type_id (product_type_id);

-- 支付:按 user_id、status 过滤
ALTER TABLE payment ADD KEY idx_user_id (user_id);
ALTER TABLE payment ADD KEY idx_status (status);

-- 浏览历史:按 user_id 聚合、按 product_id 关联
ALTER TABLE product_browsing_history ADD KEY idx_user_id (user_id);
ALTER TABLE product_browsing_history ADD KEY idx_product_id (product_id);

-- 订单评价:按 user_id / product_id / product_order_id 查
ALTER TABLE product_order_evaluate ADD KEY idx_user_id (user_id);
ALTER TABLE product_order_evaluate ADD KEY idx_product_id (product_id);
ALTER TABLE product_order_evaluate ADD KEY idx_product_order_id (product_order_id);

-- 优惠券:selectEnabled 按 status 过滤
ALTER TABLE coupon ADD KEY idx_status (status);

-- ─────────────────────────── 三、执行前自检(建议先跑) ───────────────────────────
-- 若以下任一查询返回行,先处理重复数据再执行本脚本:
--
--   SELECT user_id, product_id, COUNT(*) FROM shopping_cart
--     GROUP BY user_id, product_id HAVING COUNT(*) > 1;
--   SELECT user_id, product_id, COUNT(*) FROM product_collect
--     GROUP BY user_id, product_id HAVING COUNT(*) > 1;
--   SELECT user_id, shop_id, COUNT(*) FROM shop_collect
--     GROUP BY user_id, shop_id HAVING COUNT(*) > 1;
--   SELECT 'user' AS t, username, COUNT(*) FROM user GROUP BY username HAVING COUNT(*) > 1
--   UNION ALL SELECT 'shop', username, COUNT(*) FROM shop GROUP BY username HAVING COUNT(*) > 1
--   UNION ALL SELECT 'admin', username, COUNT(*) FROM admin GROUP BY username HAVING COUNT(*) > 1;

-- ─────────────────────────── 四、执行后验证 ───────────────────────────
--   SHOW INDEX FROM shopping_cart;   -- 应有 uk_user_product(UNIQUE)
--   SHOW INDEX FROM product_order;   -- 应有 idx_order_no / idx_user_id / idx_shop_id / idx_status_create_time
-- 再跑一次应用闸门(mvn -B clean test)确认无回归。

-- ─────────────────────────── 五、本库已存在的键(勿重复建) ───────────────────────────
--   conversation.uk_user_shop(user_id, shop_id)      coupon.uk_code(code)
--   message.idx_conversation(conversation_id)        message.idx_conv_time(conversation_id, create_time)
--   notification.idx_role_user(role, user_id)        payment.uk_order_no(order_no)
--   product_order.idx_order_no(order_no)             return_request.idx_user_id(user_id)
--   stock_alert.uk_user_product(user_id, product_id) user_coupon.uk_user_coupon(user_id, coupon_id)
--   user_notification_pref.uk_user_id(user_id)
