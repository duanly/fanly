# 换新服务器 · 一页跑完

两个互相独立的 docker 栈：

```
/opt/edge    共享 Caddy 入口   占 80/443，管 TLS 和域名分发
/opt/fanly   fanly 应用        不占端口，挂在 edge 网络上
```

好处是以后再上第二个应用，只在 `/opt/edge/conf.d/` 丢一个文件，
fanly 一个字都不用动，也不用停。

完整说明见 `DEPLOY.md`，这页是换机时照抄的最短路径。

---

## 0 · 开工前

| 检查项 | 怎么确认 |
| --- | --- |
| 域名 A 记录指向新机 IP | `dig +short 你的域名` 对一下 |
| 安全组放行 80 **和** 443 | 80 不是可选的，Let's Encrypt 校验走 80 |
| 域名已备案 | 没备案国内机器 80/443 会被封 |

**先别急着把 DNS 切过来。** 顺序是：新机部署好 → 用 `curl --resolve` 验证 → 再切 DNS。
这样切换期间老机还在服务，出问题随时切回去。

---

## 1 · 装 Docker

```bash
apt-get update && apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

镜像加速（腾讯云机器才有内网源）：

```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{ "registry-mirrors": ["https://mirror.ccs.tencentyun.com"] }
JSON
systemctl restart docker
docker pull caddy:2-alpine    # 预期几十秒拉完
```

---

## 2 · 先看宿主机上有没有 Caddy

```bash
ss -tnlp | grep -E ':(80|443)'
systemctl status caddy --no-pager 2>/dev/null | head -3
```

**已经有一个 systemd 管的 Caddy 在占 80/443**（多半是别的应用在用）→ 别再起容器化入口，
让它当入口就行，跳过本节和第 3 节里的 edge 部分，改用 **附录 A · 接宿主机 Caddy**。

**80/443 是空的** → 按下面起容器化入口。

---

## 2b · 起共享入口（容器化）

```bash
git clone https://github.com/duanly/fanly.git /opt/src-fanly

docker network create edge
mkdir -p /opt/edge
cp -r /opt/src-fanly/deploy/edge/. /opt/edge/
cd /opt/edge

cp .env.example .env
vi .env                       # 填 ACME_EMAIL

cp conf.d/fanly.caddy.example conf.d/fanly.caddy
vi conf.d/fanly.caddy         # 第一行换成你的域名

docker compose up -d
docker compose logs -f caddy
```

**预期**：日志里没有报错。这时还没有证书是正常的——上游 `fanly-caddy` 还没起来，
DNS 也还没切，Caddy 会等第一个请求进来才去签。

systemd 托管（可选，但建议）：

```bash
cp /opt/edge/edge-caddy.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now edge-caddy
```

以后改路由热重载，不断连接：`systemctl reload edge-caddy`

---

## 3 · 起 fanly

```bash
mkdir -p /opt/fanly
cp /opt/src-fanly/docker-compose.yml \
   /opt/src-fanly/docker-compose.edge.yml \
   /opt/fanly/
cd /opt/fanly

cp /opt/src-fanly/.env.example .env
```

生成密码：

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "DB_PASS=$(openssl rand -base64 18)"
echo "DB_ROOT_PASS=$(openssl rand -base64 18)"
echo "REDIS_PASS=$(openssl rand -base64 18)"
```

`vi .env`，把上面四行粘进去，再改这几项：

```bash
IMAGE_PREFIX=ghcr.io/duanly
IMAGE_TAG=latest
DOMAIN=你的域名                # 不带 http://，不带斜杠
ACME_EMAIL=你的邮箱

DB_SYNC=true                   # 首次建表用，建完立刻改回 false
ENABLE_DOCS=false
SKIP_SMS_VERIFY=true           # 测试期免验证码，正式运营前必须 false

# 拼多多（多多进宝）
PDD_CLIENT_ID=
PDD_CLIENT_SECRET=
PDD_PID=
```

**关键一行**——不加这个就会去抢 80/443，跟入口打架：

```bash
echo 'COMPOSE_FILE=docker-compose.yml:docker-compose.edge.yml' >> .env
```

加了它之后，以后照常敲 `docker compose up -d` 就会自动合并两个文件，不用带 `-f`。

拉镜像启动：

```bash
docker compose pull
docker compose up -d
docker compose ps             # 预期 mysql/redis healthy，server/web running
docker compose logs server | grep "CPS 渠道"
```

建完表马上关掉自动建表：

```bash
sed -i 's/^DB_SYNC=true/DB_SYNC=false/' .env
docker compose up -d server
```

---

## 4 · 切 DNS 之前先验证

不用等 DNS，直接把域名指到新机 IP 测：

```bash
NEW_IP=新机公网IP
curl -I --resolve 你的域名:80:$NEW_IP  http://你的域名/
curl -s --resolve 你的域名:80:$NEW_IP  http://你的域名/api/health
```

`/api/health` 返回 `{"status":"ok"}` 就说明 edge → fanly-caddy → server 整条链通了。

HTTPS 得等 DNS 切过来才签得下证书（Let's Encrypt 要从公网访问你的域名做校验）。

确认没问题 → 去 DNS 控制台把 A 记录改成新机 IP → 等几分钟：

```bash
dig +short 你的域名
curl -I https://你的域名/
docker compose -f /opt/edge/docker-compose.yml logs caddy | grep -i certificate
```

看到 `certificate obtained successfully` 就成了。

---

## 5 · 搬数据（可选）

还在测试阶段、数据不要了就跳过这节，新库是干净的。

**老机上导出**：

```bash
cd /opt/fanly
docker compose exec -T mysql \
  mysqldump -u root -p"$(grep ^DB_ROOT_PASS .env | cut -d= -f2-)" \
  --single-transaction --routines fanly > /tmp/fanly.sql
```

**传到新机**：

```bash
scp /tmp/fanly.sql root@新机IP:/tmp/
```

**新机上导入**（先停 server，避免写入打架）：

```bash
cd /opt/fanly
docker compose stop server
docker compose exec -T mysql \
  mysql -u root -p"$(grep ^DB_ROOT_PASS .env | cut -d= -f2-)" fanly < /tmp/fanly.sql
docker compose start server
```

导完跑一次对账，确认流水和余额对得上：

```bash
curl -s https://你的域名/api/admin/reconcile -H "Authorization: Bearer <管理员token>"
```

---

## 6 · 收尾

- [ ] `DB_SYNC=false`
- [ ] `ENABLE_DOCS=false`
- [ ] 后台 `admin / admin123` 改密码
- [ ] 正式运营前 `SKIP_SMS_VERIFY=false`
- [ ] 老机确认没流量了再退

---

## 排错

| 现象 | 原因 | 怎么查 |
| --- | --- | --- |
| 502 | 应用没接上 edge 网络，或容器名对不上 | `docker network inspect edge` 看成员里有没有 `fanly-caddy` |
| 入口日志 `lookup fanly-caddy: server misbehaving` | 同上，容器名和 `conf.d/fanly.caddy` 里写的不一致 | `docker ps --format '{{.Names}}'` |
| web 容器反复重启 | 镜像太旧，没有 `Caddyfile.edge` | `docker compose pull web` |
| 证书签不下来 | 80 没放行，或 DNS 还没生效 | `dig +short 域名`、安全组入站规则 |
| fanly 起来后入口 502 变 404 | 两边都在抢 80，`COMPOSE_FILE` 那行没加 | `grep COMPOSE_FILE /opt/fanly/.env` |

**证书卷别删** —— 在 `/opt/edge` 的 `caddy-data` 里，删了重签会撞 Let's Encrypt 频率限制（同域名每周 5 次）。

---

## 附录 A · 接宿主机已有的 Caddy

宿主机上已经有 systemd 管的 Caddy 时用这条路。它已经在服务别的域名、证书也都在，
不要动它——让 fanly 挂在它后面。

跟容器化入口的唯一区别：**宿主机进程解析不了 docker 的容器名**，
所以 fanly 不走 `edge` 网络，而是在回环口开一个端口给它反代。

`/opt/fanly/` 里放 `docker-compose.hostcaddy.yml`（仓库里有），然后：

```bash
cd /opt/fanly
sed -i 's/^COMPOSE_FILE=.*/COMPOSE_FILE=docker-compose.yml:docker-compose.hostcaddy.yml/' .env
grep -q '^HOST_PORT=' .env || echo 'HOST_PORT=8081' >> .env
docker compose up -d

curl -I http://127.0.0.1:8081/       # 预期 200，这步不通就别往下走
```

端口别和别的应用撞，`ss -tnlp | grep 8081` 确认一下。

宿主机 Caddy 那边加路由。先看它的结构：

```bash
cat /etc/caddy/Caddyfile
```

有 `import /etc/caddy/conf.d/*.caddy` 就往那个目录放文件，没有就追加到 Caddyfile 末尾：

```bash
cat > /etc/caddy/conf.d/fanly.caddy <<'CADDY'
你的域名 {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8081

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }

    @hashed path_regexp \.(js|css|woff2?|png|jpg|svg)$
    header @hashed Cache-Control "public, max-age=31536000, immutable"
}
CADDY

caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

**用 `reload` 不要用 `restart`**——热加载不断连接，同机上别的应用全程无感。

---

## 附录 B · 在服务器上直接构建（不等 CI）

改一行代码就要等 Actions 跑完、再从 GHCR 拉几百兆镜像，验证一次十几分钟，
调试期间太慢。直接在服务器上从源码构建，`git pull` 只传几 KB 的 diff，快得多。

镜像源已经在 `docker-compose.build.yml` 里配好了（npmmirror + 腾讯云 apk 源），
不用额外做什么。

### 一次性：把 /opt/fanly 变成 git 仓库

**不要另开一个目录跑 compose。** compose 的项目名默认取目录名，
换了目录就是另一个项目，会新建一套空的 MySQL 卷——数据全没了。
所以就地把现有目录接上仓库：

```bash
cd /opt/fanly
cp .env /root/fanly.env.bak          # 先备份，.env 是 gitignore 的不会被覆盖，但保险

git init
git remote add origin https://github.com/duanly/fanly.git
git fetch origin main
git checkout -f -b main origin/main

ls .env && grep -c . .env            # 确认 .env 还在
```

### 切成本地构建

```bash
cd /opt/fanly
sed -i 's|^COMPOSE_FILE=.*|COMPOSE_FILE=docker-compose.yml:docker-compose.hostcaddy.yml:docker-compose.build.yml|' .env
grep COMPOSE_FILE .env
```

`docker-compose.build.yml` 必须排在最后——它把 `image` 覆盖成 `fanly-server:local`，
排前面会被主文件的 GHCR 地址盖回去。

### 以后每次改完代码

```bash
tmux new -s build                    # SSH 断了构建还在跑
cd /opt/fanly
git pull
docker compose up -d --build
docker compose logs -f server
```

**一定要在 tmux 里跑。** 构建要几分钟，SSH 一断 docker build 就被杀，前功尽弃。

只改了服务端就只构建它，省一半时间：

```bash
docker compose up -d --build server
```

### 注意

- **第一次构建慢**（拉 node:22-alpine + 装三个项目的依赖，几分钟），之后有层缓存，
  只改源码不改 `package.json` 的话一分钟以内
- **磁盘**：构建缓存会涨，`df -h` 紧张了就 `docker builder prune -f`
- **要回到 CI 镜像**：把 `.env` 里 `COMPOSE_FILE` 末尾的 `:docker-compose.build.yml` 去掉，
  再 `docker compose pull && docker compose up -d`
