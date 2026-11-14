-- 选品池防误伤：详情接口连续空结果计数
-- 背景：京东/唯品会详情接口故障（配额 4005/限流/超时）曾被 provider 吞成 null，
-- 导致整池商品被误判「已下架」而集体 EXPIRED。改造后需要连续 2 轮空结果才下架，
-- failCount 记录连续次数，任何一轮正常返回即归零。
--
-- 生产库 synchronize=false，需手动执行（本机/CI 的 sqlite 由 synchronize 自动建列）：
--   docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < server/scripts/sql/2026-11-14-curated-fail-count.sql
--
-- 执行前确认列不存在：
--   SHOW COLUMNS FROM curated_goods LIKE 'failCount';

ALTER TABLE curated_goods
  ADD COLUMN failCount INT NOT NULL DEFAULT 0;

-- 历史上被误下架（EXPIRED + 原因是「商品已下架或退出推广」）的商品不必手动恢复：
-- 定时刷新每 6 小时扫描 ON+EXPIRED，接口恢复正常后会自动救回 ON。
