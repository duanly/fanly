# 数据迁移指南

从测试服务器导出数据，导入到正式服务器。

## 一、测试服务器（导出）

```bash
cd server

# 1. 导出所有表
npx ts-node scripts/export-data.ts

# 2. 只导出核心表
npx ts-node scripts/export-data.ts --tables user,cps_order,agent,withdraw

# 3. 指定输出目录
npx ts-node scripts/export-data.ts --out ./data/my-backup
```

导出的目录在 `./data/export-YYYYMMDD-HHmmss/`，结构：

```
export-20261023-150000/
├── _manifest.json       # 元信息（表名、行数等）
├── user.json
├── cps_order.json
├── topic.json
└── ...
```

打包传输：

```bash
tar czf export.tar.gz data/export-20261023-150000/

# 传到正式服务器（举例）
scp export.tar.gz root@your-server:/path/to/server/
```

## 二、正式服务器（导入）

```bash
cd server
tar xzf export.tar.gz

# 1. 预览要导入的内容（会提示确认，输入 yes 才执行）
npx ts-node scripts/import-data.ts --dir data/export-20261023-150000

# 2. 只导入指定表
npx ts-node scripts/import-data.ts --dir ... --tables user,topic

# 3. 清空目标表再导入（危险！确认目标库是空的才用）
npx ts-node scripts/import-data.ts --dir ... --truncate

# 4. 跳过确认（脚本里用）
npx ts-node scripts/import-data.ts --dir ... --yes
```

## 三、注意事项

### 数据量很大时（超过 10 万行）

- 导出脚本已经分批读取，不会爆内存
- 导入脚本每批 200 条，速度稳定
- 建议分表导出分表导，比如先导用户、再导订单

### MySQL 模式

正式服务器一般用 MySQL。确保 `.env` 里配置：

```
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=xxx
DB_NAME=fanly
```

**导入前确保数据库已经初始化（跑过一遍 Nest 服务，表都建好了）**。

### SQLite → MySQL 迁移

脚本自动适配两种数据库。但有一个限制：

- **SQLite 导出 → MySQL 导入**：完全支持，UPSERT 正常工作
- **MySQL 导出 → SQLite 导入**：主键冲突时会跳过（SQLite 没有方便的 ON DUPLICATE KEY UPDATE），如果是全新空库 + `--truncate` 也没问题

### 自增 ID

- 导入时保留原始 ID（orderId、userId 等）
- 自增计数器 MySQL 会自动调整到最大值
- 所以「先导入用户、再导入订单」这种依赖关系是 OK 的

### 哪些表建议必导

核心业务数据：
- `user` — 用户
- `agent` — 代理
- `promotion_position` — 推广位
- `cps_order` — CPS 订单
- `commission_detail` — 佣金明细
- `fund_ledger` — 资金流水
- `withdraw` — 提现记录
- `order_claim` — 订单找回
- `coin_ledger` — 金币流水
- `checkin` — 签到记录
- `cart_item` — 购物车（可选）

运营配置数据：
- `topic` — 专题/分类
- `goods_topic` — 商品-专题关联
- `curated_goods` — 选品池
- `compare_group` — 比价组
- `home_link` — 首页活动位
- `sys_config` — 系统配置
- `admin_user` — 管理员

### 哪些表不要导

- 全新部署的话，日志类、缓存类的一般不需要
- 目前项目里没有这类表，基本都可以导

## 四、完整流程示例

```bash
# === 测试服务器 ===
cd /path/to/fanly/server

# 导出全量数据
npx ts-node scripts/export-data.ts
# 假设输出目录是 data/export-20261023-153000

# 打包
tar czf /tmp/fanly-export.tar.gz -C data export-20261023-153000

# 传到正式服务器
scp /tmp/fanly-export.tar.gz root@prod-server:/tmp/

# === 正式服务器 ===
cd /path/to/fanly/server

# 先确保数据库表已创建（启动一次 Nest 服务自动建表）
# npm run start:prod &  等几秒
# pkill -f "node.*main"

# 解压
mkdir -p data
tar xzf /tmp/fanly-export.tar.gz -C data

# 导入（如果是全新库，加 --truncate 更干净）
npx ts-node scripts/import-data.ts --dir data/export-20261023-153000 --truncate
```
