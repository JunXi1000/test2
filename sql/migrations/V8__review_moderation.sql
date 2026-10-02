-- ============================================================================
-- V8: 评价审核状态(product_order_evaluate 加可空/带默认列)
-- 日期: 2026-09-28  (与 Phase 3「PUT /admin/reviews/{id} 去 no-op」配套 / 总控 TASK-000-C P0-3)
--
-- 现状:PUT /admin/reviews/{id} 原本接收 body 但从不读取,却返回 200
--      (AdminApiController L337-342 同款注释已去掉入参)。前端
--      web/src/api/modules/adminReviews.ts:176 发的是 `put('/admin/reviews/'+id, { status })`,
--      status 取值 AdminReviewStatus = 'visible' | 'hidden'。
--      库里没有任何地方存这个值,所以一刷新就丢。
--
-- ── 决策:在既有表加列,不新建审核表 ──────────────────────────────────────
-- 总控倾向「加列而非新表」,已获批。理由(写死备查):
--   1. 审核状态是**评价自身的属性**,不是独立实体。没有「一条评价对应多条审核记录」
--      的需求(不存审核历史/多轮复核),拆表会立刻产生 1:N 的无意义 join。
--   2. 加列**不破坏现有查询**:ProductOrderEvaluateService.list() 走
--      ProductOrderEvaluateMapper 的 `SELECT product_order_evaluate.*`
--      (见 mapper/ProductOrderEvaluateMapper.xml),`.*` 会自动带出新列,
--      实体 ProductOrderEvaluate 不加字段也只是忽略多余列 —— MyBatis 默认
--      不对未知列报错。新表则要让 mapper 多一次 join/一次查询。
--   3. 存量行语义必须不变:新列带 DEFAULT 'visible',存量评价全部视为「可见」,
--      与迁移前「所有评价都在列表里」的行为**逐字一致**,不存在历史数据需要回填。
--
-- ── 关于「可空」的取舍(请总控注意这一处) ─────────────────────────────────
-- 四个新列里 review_status / reviewer_id / review_time / review_remark 中,
-- 后三个是**可空**的(未审核时没有审核人/时间/备注)。
-- review_status 则取 **NOT NULL DEFAULT 'visible'** 而不是可空,理由:
--   「未设置状态」在本业务里没有含义 —— 存量行就是 visible,新行就是 visible 或 hidden,
--   NULL 会让应用层到处写 `status == null ? 'visible' : status`,反而多一个出错面。
--   ADD COLUMN ... NOT NULL DEFAULT 在 MySQL 8 上是纯元数据操作,
--   存量行按 DEFAULT 物化,**不回填 NULL、不改任何现有值**,因此不构成破坏性变更。
--   (若总控坚持可空,改这一行即可,其余部分不受影响。)
--
-- ── 字段取值约定(应用层必须照此写,别自造枚举) ────────────────────────────
--   review_status  : 'visible' | 'hidden'   ← 直接用前端 AdminReviewStatus,不要另起中文枚举
--   reviewer_id    : admin.id
--   review_time    : DATETIME,审核动作发生时刻
--   review_remark  : 驳回/隐藏原因(可选)
--
-- ── 幂等性与执行方式 ──────────────────────────────────────────────────────
-- MySQL 8 的 ADD COLUMN **不可重复执行**(第二次报 1060/1061)。
--   mysql --default-character-set=utf8mb4 -u<user> -p<pwd> <db> < sql/migrations/V8__review_moderation.sql
-- 要重跑请先执行 rollback 脚本。
-- 回滚:sql/migrations/rollback/V8__review_moderation.sql
-- ============================================================================

ALTER TABLE `product_order_evaluate`
  -- 默认 'visible':存量评价全部视为可见,与迁移前行为一致,无需回填数据
  ADD COLUMN `review_status` VARCHAR(20) NOT NULL DEFAULT 'visible' COMMENT '审核状态 visible=可见 / hidden=隐藏' AFTER `rate`,
  -- 以下三列未审核时为空
  ADD COLUMN `reviewer_id` INT DEFAULT NULL COMMENT '审核人(admin.id),未审核时为 NULL' AFTER `review_status`,
  ADD COLUMN `review_time` DATETIME DEFAULT NULL COMMENT '审核时间,未审核时为 NULL' AFTER `reviewer_id`,
  ADD COLUMN `review_remark` VARCHAR(500) DEFAULT NULL COMMENT '审核备注/隐藏原因' AFTER `review_time`;

-- 索引依据:审核列表是**全量分页**(GET /admin/reviews 不带 status 过滤),
-- 但后台筛选/只看待审会按 review_status 过滤并按 review_time 排序,
-- 故用 (review_status, review_time) 复合索引,既可过滤又可排序。
-- 行数评估:评价表与订单同阶(演示库个位数,生产百万级以下),
-- 单列索引即可,复合索引只在确有「按状态+时间」查询时才回表更优 —— 保留复合。
ALTER TABLE `product_order_evaluate` ADD KEY `idx_review_status_time` (`review_status`, `review_time`);

-- ─────────────────────────── 执行后验证 ───────────────────────────
--   SHOW COLUMNS FROM product_order_evaluate LIKE 'review%';
--     -- 应有 review_status / reviewer_id / review_time / review_remark 四行
--   SELECT COUNT(*) AS total,
--          SUM(review_status = 'visible') AS visible_rows,
--          SUM(reviewer_id IS NULL) AS unreviewed_rows
--     FROM product_order_evaluate;
--     -- visible_rows 应等于 total(存量全部可见),unreviewed_rows 应等于 total
--   SHOW INDEX FROM product_order_evaluate WHERE Key_name = 'idx_review_status_time';
-- 再跑一次应用闸门(mvn -B clean test)确认无回归。