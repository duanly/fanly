# 部署到腾讯云 CVM（Docker + Caddy 自动 HTTPS）

单域名路径分流：根路径是 H5，`/admin` 是管理后台，`/api` 反代到服务端。
一个域名一张证书，同源没有跨域问题。

第 1–8 步是首次部署，照着抄就行，每步都标了「预期看到什么」，对不上就停下别往下走。
第 9–10 步是跑通之后的优化，**先验证成功再做**。

---

## 第 0 步 · 开工前确认

| 检查项 | 怎么确认 |
| --- | --- |
| 域名已 ICP 备案 | 备案没下来的话国内机器 80/443 会被封 |
| 域名 A 记录指向本机 | 见第 4 步的比对命令 |
| 安全组放行 80 **和** 443 | 腾讯云控制台 → 安全组 → 入站规则 |

**80 端口不是可选的。** Caddy 签证书时 Let's Encrypt 会回来访问 80 做校验，只开 443 一定签不下来。

---

## 第 1 步 · 装 Docker

`get.docker.com` 在国内连不上，别用官方那个一键脚本。从阿里云的 apt 源装：

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
docker version
```

**预期**：`docker version` 同时打出 Client 和 Server 两段。

> `mirrors.aliyun.com` 连不上就把两处都换成 `mirrors.tuna.tsinghua.edu.cn`。

---

## 第 2 步 · 配镜像加速

不配这步，后面拉 MySQL、Node、Caddy 全会超时。腾讯云用内网源，不走公网：

```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
systemctl restart docker

docker pull mysql:8.0
```

**预期**：几十秒内拉完，出现 `Status: Downloaded newer image for mysql:8.0`。

> 这个内网源只在腾讯云机器上能用，别拿去别家。

---

## 第 3 步 · 拉代码、填配置

```bash
cd /opt
git clone https://github.com/duanly/fanly.git
cd fanly
cp .env.example .env
```

先把密码生成出来：

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "DB_PASS=$(openssl rand -base64 18)"
echo "DB_ROOT_PASS=$(openssl rand -base64 18)"
echo "REDIS_PASS=$(openssl rand -base64 18)"
```

`vi .env`，把上面四行的输出粘进去，另外改这几项：

```bash
IMAGE_PREFIX=registry.cn-guangzhou.aliyuncs.com/duanly   # ACR 地址+命名空间，见第 9 步
IMAGE_TAG=latest             # 回滚时换成 sha-xxxxxxx
DOMAIN=你的域名              # 不带 http://，不带斜杠
ACME_EMAIL=你的邮箱          # 证书到期通知
DB_SYNC=true                 # 首次建表用，第 6 步会改回 false
ENABLE_DOCS=false            # 接口文档不对外
```

`.env` 已经在 `.gitignore` 里，不会被提交。

---

## 第 4 步 · 确认域名解析

```bash
echo "本机公网 IP: $(curl -s ifconfig.me)"
echo "域名解析到:  $(dig +short 你的域名 | tail -1)"
```

**预期**：两行 IP 一样。

不一样就等 DNS 生效，别往下走——解析没生效的情况下启动，Caddy 签证书会失败，反复重试还会撞 Let's Encrypt 的频率限制。

---

## 第 5 步 · 启动

镜像由 GitHub Actions 构建好推到阿里云 ACR，服务器只管拉。

先登录 ACR（一次就够，凭证会存在 `~/.docker/config.json`）：

```bash
docker login registry.cn-guangzhou.aliyuncs.com -u 你的ACR用户名
```

```bash
cd /opt/fanly
docker compose pull
docker compose up -d
docker compose logs -f web
```

**预期**：出现 `certificate obtained successfully`。`Ctrl+C` 退出日志。

拉镜像通常一两分钟。CI 还没配好、或者想临时从源码构建，见本文档末尾的「本地构建」。

## 第 6 步 · 关掉自动建表

上一步已经把表建好了。**马上关掉**，别拖：

```bash
sed -i 's/^DB_SYNC=true/DB_SYNC=false/' .env
docker compose up -d server
```

`synchronize` 开着的话，以后改实体字段 TypeORM 会自作主张改表结构。返利平台的表被它删个字段就是资金事故，这步别省。

---

## 第 7 步 · 验证

```bash
docker compose ps
```

**预期**：`server` 那行 STATUS 是 `Up ... (healthy)`。刚起来那一分钟可能还是 `starting`，等等再看。

```bash
curl https://你的域名/api/health
```

**预期**：`{"code":0,"msg":"ok","data":{"status":"ok","db":"mysql","uptime":...}}`

`"db":"mysql"` 是关键信号，说明真连上 MySQL 了。

灌演示数据（正式运营前清掉）：

```bash
docker compose exec server node dist/seed.js
```

**预期**：打印出管理员、两个代理的推广码、四个用户。

---

## 第 8 步 · 浏览器过一遍

| | 地址 | 账号 |
| --- | --- | --- |
| H5 | https://你的域名 | `13900000001`，点「获取验证码」 |
| 管理后台 | https://你的域名/admin | `admin` / `admin123` |

**登进后台第一件事是改密码。**

这是第一次连真 MySQL，之前所有验证都跑在 SQLite 上，按这个顺序点最容易炸出问题：

1. 仪表盘 → **立即对账**
2. 订单管理 → **手动拉单**
3. 代理管理 → 看两个代理的业绩
4. H5 登录 → 首页选商品 → 详情页 → 领券购买
5. H5 我的 → 提现 → 后台提现审核 → 通过 → 登记打款

报错就看日志：

```bash
docker compose logs --tail=50 server
```

---

## 第 9 步 · 配 CI 自动构建（只做一次）

配好之后，push 到 main 就自动出镜像，服务器不用再装编译工具链、不用跑 `npm ci`，
也不会再出现 SSH 断线把构建打断的事。

### 开通阿里云 ACR 个人版

控制台 → 容器镜像服务 → 个人实例（免费）：

1. 建命名空间，比如 `duanly`，**仓库类型选私有**
2. 设置 Registry 登录密码（跟阿里云账号密码是两回事）
3. 记下三样东西：
   - registry 地址，形如 `registry.cn-guangzhou.aliyuncs.com`（选离服务器近的区）
   - 命名空间名
   - 用户名（一般是阿里云账号全名）和刚设的密码

### 填 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret，加四条：

| 名字 | 值 |
| --- | --- |
| `ACR_REGISTRY` | `registry.cn-guangzhou.aliyuncs.com` |
| `ACR_NAMESPACE` | `duanly` |
| `ACR_USERNAME` | ACR 用户名 |
| `ACR_PASSWORD` | ACR 登录密码 |

### 触发

push 到 main 自动跑（只改 `.md` 不触发）。也可以在 Actions 页面手动点 Run workflow。

出来的标签：

| 标签 | 什么时候有 |
| --- | --- |
| `latest` | 每次 push main |
| `sha-4fe247f` | 每次构建都有，**回滚就用它** |
| `v1.0.0` | 打了 `git tag v1.0.0` 时 |

### 服务器更新

```bash
cd /opt/fanly
git pull                    # 拿到 compose 和文档的改动
docker compose pull         # 拉新镜像
docker compose up -d
```

### 回滚

```bash
# .env 里把 IMAGE_TAG 改成想回到的那个 sha
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-4fe247f/' .env
docker compose up -d
```

比重新构建快得多，出事的时候这点很关键。

### 三个设计说明

**镜像源是构建参数，不写死。** CI 跑在 GitHub 的机器上，用官方 npm 源最快；
在国内服务器本地构建时由 `docker-compose.build.yml` 传国内源进去。
另外 `package-lock.json` 里记死了 npmjs.org 的下载地址，光 `npm config set registry`
不生效，Dockerfile 里用 `sed` 把锁文件一起替换了——「卡在 npm ci」多半是这个原因。

**生产镜像不装 better-sqlite3。** 它只有本地开发用得上，却要装 gcc 从源码编译。
现在它在 `devDependencies` 里，运行阶段 `npm ci --omit=dev --omit=optional` 跳过——
两个 omit 都得给，因为它在锁文件里被标成 `devOptional`。

**`build` 脚本是 `nest build && tsc-alias`。** 代码里用了 `@/entities` 这种路径别名，
`tsc` 只做 TypeScript 层面的映射，编译出来的 JS 里还是 `require("@/entities")`。
开发时 `ts-node -r tsconfig-paths/register` 能兜住，但容器里是 `node dist/main.js`，
启动就会 `Cannot find module '@/entities'` 直接挂掉。**动 build 脚本前先想清楚这条。**

---

## 第 10 步 · 改成共享 Caddy（一台机器跑多个应用时）

80 和 443 只能被一个进程占。上面的装法里 fanly 的 Caddy 容器霸着这两个端口，
**下一个应用就没法用了**。要在同一台机器上部署别的应用，就得把 Caddy 抽出来当统一入口。

### 为什么不装宿主机 Caddy

国内拉 Caddy 的 apt 源和 GitHub 二进制都不顺，而 `caddy:2-alpine` 镜像第 2 步已经拉下来了。
用它单独起一个共享代理容器，再用 systemd 管着，效果跟宿主机 Caddy 一样，省掉下载的麻烦。

### 架构

两层：**前面一个 Caddy 只管 TLS 和域名分发**，各应用自己那个 Caddy 管内部路径路由。
每加一个应用，只在 `conf.d/` 丢一个文件。

```
公网 :80/:443
   └── shared-caddy（TLS + 域名分发）
         ├── fanly.com      → fanly-web:80 → 内部 Caddy 管 / /admin /api
         └── app2.com       → app2-web:80
```

### 建共享代理

```bash
docker network create web

mkdir -p /opt/caddy/conf.d && cd /opt/caddy

cat > Caddyfile <<'EOF'
{
    email 你的邮箱
}

# 每个应用一个文件，加应用不用动这里
import /etc/caddy/conf.d/*.caddy
EOF

cat > conf.d/fanly.caddy <<'EOF'
你的域名 {
    encode zstd gzip
    reverse_proxy fanly-web:80
}
EOF

cat > docker-compose.yml <<'EOF'
services:
  caddy:
    image: caddy:2-alpine
    container_name: shared-caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./conf.d:/etc/caddy/conf.d:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - web

volumes:
  caddy-data:
  caddy-config:

networks:
  web:
    external: true
EOF
```

### 改 fanly：不再占 80/443

编辑 `/opt/fanly/docker-compose.yml` 的 `web:` 那一段，**删掉整块 `ports`**，换成网络别名，
并挂上不签证书的那份 Caddyfile：

```yaml
  web:
    build:
      context: .
      dockerfile: deploy/Dockerfile.web
    restart: always
    depends_on:
      - server
    volumes:
      - ./deploy/Caddyfile.local:/etc/caddy/Caddyfile:ro
    networks:
      default:
      web:
        aliases:
          - fanly-web
```

文件末尾补上网络声明：

```yaml
networks:
  default:
  web:
    external: true
```

顶层 `volumes:` 里原来那三个 `caddy-*` 卷可以删了，证书现在归共享 Caddy 管。

### 起

```bash
cd /opt/fanly && docker compose up -d
cd /opt/caddy && docker compose up -d
docker compose logs -f caddy      # 等 certificate obtained
```

### systemd 托管

```bash
cat > /etc/systemd/system/shared-caddy.service <<'EOF'
[Unit]
Description=Shared Caddy reverse proxy
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/caddy
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now shared-caddy
```

改完配置热重载，不断连接：

```bash
systemctl reload shared-caddy
```

### 以后加新应用

新应用的 compose 里：**不写 `ports`**，加 `networks: [default, web]` 和一个别名，然后

```bash
cat > /opt/caddy/conf.d/app2.caddy <<'EOF'
app2.你的域名 {
    reverse_proxy app2-web:内部端口
}
EOF
systemctl reload shared-caddy
```

证书自动签，各应用互不干扰。

---

## 日常运维

```bash
docker compose ps                      # 看状态
docker compose logs -f server          # 跟服务端日志
docker compose restart                 # 全部重启
```

更新：

```bash
cd /opt/fanly
git pull                               # compose / 文档的改动
docker compose pull                    # 新镜像
docker compose up -d
```

**数据库备份**，写进 crontab 每天跑：

```bash
mkdir -p /backup
cat > /usr/local/bin/fanly-backup.sh <<'EOF'
#!/bin/bash
cd /opt/fanly
source .env
docker compose exec -T mysql \
  mysqldump -u root -p"$DB_ROOT_PASS" --single-transaction "$DB_NAME" \
  | gzip > /backup/fanly-$(date +%F).sql.gz
find /backup -name 'fanly-*.sql.gz' -mtime +30 -delete
EOF
chmod +x /usr/local/bin/fanly-backup.sh

( crontab -l 2>/dev/null; echo "30 3 * * * /usr/local/bin/fanly-backup.sh" ) | crontab -
```

资金流水表丢了就没法跟用户对账，这个务必配上。

---

## 排错速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `docker compose pull` 报 denied | 没登录 ACR，或镜像还没推上去 | `docker login`；看 Actions 跑完没 |
| 镜像拉不到 manifest unknown | `IMAGE_TAG` 写错 | 去 ACR 控制台看有哪些标签 |
| 本地构建卡在 `npm ci` | 没叠加 build 覆盖文件 | 见文末「本地构建」 |
| 容器起来就退，日志报 `Cannot find module '@/...'` | 构建漏了 tsc-alias | 检查 package.json 的 build 脚本 |
| `certificate obtained` 一直不出现 | 80 没放行，或解析没生效 | 回第 0、4 步 |
| `server` 卡在 `starting` | MySQL 还在初始化 | 等 1 分钟；仍不行看 `logs server` |
| 拉镜像超时 | 加速源没配或配错 | 回第 2 步 |
| 端口被占用起不来 | 别的应用占了 80/443 | 做第 10 步 |
| 页面能开但数据全空 | 没灌种子数据 | 跑第 7 步的 seed |
| 后台点对账报 500 | 贴日志 | `logs --tail=50 server` |
| 提现审核通过但没打款 | 打款通道还没接，需手工登记 | 后台「登记打款成功」 |

---

## 几条不要踩的线

- **证书卷别删** —— 独立部署是 fanly 的 `caddy-data`，共享模式是 `/opt/caddy` 下的 `caddy-data`。
  删了重签会撞 Let's Encrypt 的频率限制（同域名每周 5 次），撞上只能等一周
- **MySQL 和 Redis 没暴露端口**，只在 compose 内网可达，这是故意的，别改成 `ports`
- **时区已设成 `Asia/Shanghai`**，MySQL 也是 `+08:00`，订单时间跟联盟后台对得上，别动
- **`ENABLE_DOCS` 保持 false** —— 它把所有接口和参数结构都列出来
- **`DB_SYNC` 保持 false** —— 只有首次建表才开
- **改了 `.env` 要重启对应容器**才生效

---

## 后续：接聚合服务商

拿到 key 后改 `.env`：

```bash
CPS_PROVIDER=aggregator
AGG_BASE_URL=https://...
AGG_API_KEY=...
```

```bash
docker compose up -d server
```

切之前先在本地用 `CPS_PROVIDER=aggregator` 跑一遍，确认转链能带上子渠道参数、拉单能反解出 userId，
再动生产。归属参数丢了的话所有订单都会变成「未归属」，返利发不出去。


---

## 附录：本地构建（不用 CI 时）

CI 还没配好，或者想在服务器上直接从源码构建，叠加 `docker-compose.build.yml`：

```bash
cd /opt/fanly
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

它会把国内镜像源作为 build args 传进去（npm 走淘宝源，apk 走腾讯云内网源）。
不在腾讯云上跑的话，把文件里的 `mirrors.tencentyun.com` 换成 `mirrors.aliyun.com`。

**服务器上本地构建要挂 tmux**，SSH 一断构建就被杀：

```bash
apt-get install -y tmux
tmux new -s fanly
# 离开按 Ctrl+b 再 d，回来 tmux attach -t fanly
```

已完成的层有 BuildKit 缓存，中断后重跑会接着走。

想看详细进度：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build --progress=plain
```

### 本地 HTTP 调试（不签证书，走 8080）

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.local.yml up -d --build
```

- H5 http://localhost:8080
- 后台 http://localhost:8080/admin
- 服务端直连 http://localhost:3000
- MySQL 客户端连 127.0.0.1:13306
