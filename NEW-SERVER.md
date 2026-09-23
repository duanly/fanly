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

## 2 · 起共享入口

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
