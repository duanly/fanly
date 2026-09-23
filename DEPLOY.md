# 部署到国内 VPS（Docker + Caddy 自动 HTTPS）

单域名路径分流：根路径是 H5，`/admin` 是管理后台，`/api` 反代到服务端。
一个域名一张证书，同源没有跨域问题。

## 一、服务器准备

```bash
# 装 Docker（国内机器建议先换源）
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 放行端口
# 云厂商安全组要开 80 和 443，其中 80 是 Caddy 签证书必须的，不能只开 443
```

**域名解析**：把 A 记录指到服务器公网 IP，等 `ping 你的域名` 能通了再往下走。
Caddy 签证书时 Let's Encrypt 会回来访问 80 端口做校验，解析没生效会失败。

## 二、上传代码并配置

```bash
git clone <你的仓库> /opt/fanly && cd /opt/fanly
# 或者直接 scp 整个目录上去

cp .env.example .env
vi .env
```

`.env` 必须改的几项：

```bash
DOMAIN=fanli.yourdomain.com        # 已备案域名，不带 http://
ACME_EMAIL=you@example.com         # 证书到期通知邮箱

JWT_SECRET=$(openssl rand -base64 48)
DB_PASS=<强密码>
DB_ROOT_PASS=<另一个强密码>
REDIS_PASS=<再一个强密码>

DB_SYNC=true                       # 首次部署要 true，建完表立刻改回 false
ENABLE_DOCS=false                  # 接口文档不对外
```

## 三、启动

```bash
docker compose up -d --build
docker compose logs -f web         # 看 Caddy 签证书，出现 certificate obtained 就成了
```

首次启动会自动建表。**建完立刻把 `DB_SYNC` 改回 `false` 再重启服务端**：

```bash
sed -i 's/^DB_SYNC=true/DB_SYNC=false/' .env
docker compose up -d server
```

这一步别跳过——`synchronize` 开着的话，以后改实体字段 TypeORM 会自作主张改表结构，
返利平台的表一旦被它删个字段就是资金事故。

灌演示数据（可选，正式上线别跑）：

```bash
docker compose exec server node dist/seed.js
```

## 四、访问

| | 地址 |
| --- | --- |
| H5 | https://你的域名 |
| 管理后台 | https://你的域名/admin |
| 接口文档 | 默认关闭，要看把 `ENABLE_DOCS=true` 再 `up -d server` |

后台默认账号 `admin / admin123`，**第一次登录后马上改密码**。

## 五、本地先试一遍（不签证书，走 HTTP 8080）

```bash
cp .env.example .env    # DOMAIN 随便填
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

- H5 http://localhost:8080
- 后台 http://localhost:8080/admin
- 服务端直连 http://localhost:3000
- MySQL 客户端连 127.0.0.1:13306

## 六、日常运维

```bash
docker compose ps                      # 看状态，server 的 health 应该是 healthy
docker compose logs -f server          # 服务端日志
docker compose up -d --build server    # 只更新服务端
docker compose up -d --build web       # 只更新前端
docker compose restart                 # 全部重启
```

**数据库备份**（写进 crontab，每天跑）：

```bash
docker compose exec -T mysql \
  mysqldump -u root -p"$DB_ROOT_PASS" --single-transaction fanly \
  | gzip > /backup/fanly-$(date +%F).sql.gz
```

资金流水表不能丢，备份一定要配上。

## 七、几个坑

- **证书目录别删**：`caddy-data` 卷存着证书，删了重签会撞 Let's Encrypt 的频率限制
  （同域名每周 5 次），撞上了只能等一周
- **80 端口必须开**：只开 443 签不了证书
- **MySQL 和 Redis 没暴露端口**，只在 compose 内网可达，这是故意的
- **改了 `.env` 要重启对应容器才生效**，`docker compose up -d` 会自动重建受影响的
- **时区**：容器里已经设成 `Asia/Shanghai`，MySQL 也是 `+08:00`，
  订单时间跟联盟后台对得上；别改
- **接口文档上线关掉**，它把所有接口和参数结构都列出来了

## 八、接聚合服务商后

拿到 key 后改 `.env`：

```bash
CPS_PROVIDER=aggregator
AGG_BASE_URL=https://...
AGG_API_KEY=...
```

然后 `docker compose up -d server`。切换前先在本地用 `CPS_PROVIDER=aggregator` 跑一遍，
确认转链能带上子渠道参数、拉单能反解出 userId，再动生产。
