#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# 国内服务器部署脚本（rsync 增量同步，不用 git）
#
# 用法：
#   ./deploy.sh <user@server>
#
# 示例：
#   ./deploy.sh root@1.2.3.4
#
# 说明：
#   1. rsync 增量同步代码到服务器（只传改动的文件，快）
#   2. 服务器上：备份当前版本 → 同步完成 → 构建镜像 → 重启容器
# ──────────────────────────────────────────────────────────

set -e

REMOTE=${1:?"用法: $0 <user@server>  例如: $0 root@1.2.3.4"}
REMOTE_DIR="/opt/fanly"

# 用 docker-compose.yml + docker-compose.build.yml 从源码本地构建
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.build.yml"

# 需要排除的文件/目录
EXCLUDES=(
  --exclude='node_modules'
  --exclude='.git'
  --exclude='dist'
  --exclude='.next'
  --exclude='*.log'
  --exclude='.DS_Store'
  --exclude='.env'
  --exclude='.env.*'
  --exclude='server/dist'
  --exclude='admin/dist'
  --exclude='h5/dist'
  --exclude='update.tar.gz'
  --exclude='deploy.sh'
)

cd "$(dirname "$0")"

# ── 1. 先看一下有哪些文件要传 ─────────────────────────────
echo "📋 即将同步的变更文件:"
rsync -avn --dry-run "${EXCLUDES[@]}" . "$REMOTE:$REMOTE_DIR/" \
  | grep -v 'building file list' \
  | grep -v 'sent.*bytes' \
  | grep -v 'total size is' \
  | tail -n +2 \
  | head -50

echo ""
read -p "确认同步到 $REMOTE ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 已取消"
  exit 0
fi

# ── 2. rsync 增量同步 ────────────────────────────────────
echo "📤 正在同步代码到 $REMOTE ..."
rsync -avz "${EXCLUDES[@]}" . "$REMOTE:$REMOTE_DIR/"
echo "✅ 同步完成"

# ── 3. 服务器上执行更新 ──────────────────────────────────
echo "🔧 服务器上构建并重启..."

ssh "$REMOTE" bash << 'REMOTE_SCRIPT'
  set -e
  cd /opt/fanly

  # 3.1 重新构建并重启
  echo "🐳 重新构建镜像..."
  docker compose $COMPOSE_FILES build

  echo "🔄 重启容器..."
  docker compose $COMPOSE_FILES up -d

  echo "⏳ 等待服务启动..."
  sleep 5

  echo "📊 容器状态:"
  docker compose $COMPOSE_FILES ps

  echo ""
  echo "✅ 更新完成！"
  echo "📝 查看日志: cd /opt/fanly && docker compose logs -f --tail=50"
REMOTE_SCRIPT

echo ""
echo "🎉 部署完成！"
echo "📝 查看日志: ssh $REMOTE 'cd /opt/fanly && docker compose logs -f --tail=100'"
