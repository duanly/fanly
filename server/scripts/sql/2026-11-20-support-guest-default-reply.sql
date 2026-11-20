-- 客服：未登录访客会话（忘记密码入口）+ 默认回复
-- - userId 改为可空：访客会话没有 userId，靠 guestKey 认人
-- - guestKey / guestMobile：访客凭证、访客自报手机号（未验证）
-- - pendingSince / defaultReplied：用户消息超时没人回时补发默认回复
--
-- 生产库 synchronize=false，需手动执行（本机/CI 的 sqlite 由 synchronize 自动建列）：
--   docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < server/scripts/sql/2026-11-20-support-guest-default-reply.sql
--
-- 必须在新版 server 启动前执行，否则客服接口会因缺列报错。
-- 执行前确认列不存在：
--   SHOW COLUMNS FROM support_conversation LIKE 'guestKey';

ALTER TABLE support_conversation
  MODIFY COLUMN userId INT NULL,
  ADD COLUMN guestKey VARCHAR(64) NULL,
  ADD COLUMN guestMobile VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN pendingSince DATETIME NULL,
  ADD COLUMN defaultReplied TINYINT NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX IDX_support_conversation_guestKey (guestKey),
  ADD INDEX IDX_support_conversation_pendingSince (pendingSince);
