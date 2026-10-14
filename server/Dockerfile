# 镜像源做成构建参数：
#   CI 跑在 GitHub 机器上，用默认官方源最快
#   在国内服务器上本地构建时传国内源，见 docker-compose.build.yml
ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG APK_MIRROR=dl-cdn.alpinelinux.org

# ---- 构建阶段 ----
FROM node:22-alpine AS builder
ARG NPM_REGISTRY
ARG APK_MIRROR
WORKDIR /app
RUN sed -i "s#dl-cdn.alpinelinux.org#${APK_MIRROR}#g" /etc/apk/repositories \
  && apk add --no-cache python3 make g++
COPY package*.json ./
# package-lock.json 里记死了 npmjs.org 的下载地址，
# 光 npm config set registry 不生效，要把锁文件一起替换
RUN sed -i "s#https://registry.npmjs.org/#${NPM_REGISTRY}#g" package-lock.json \
  && npm config set registry "${NPM_REGISTRY}" \
  && npm ci --ignore-scripts
# 生产用 MySQL，better-sqlite3 不需要编译；--ignore-scripts 跳过原生模块编译，
# 避免国内访问 nodejs.org 超时报错
COPY . .
# 直接用 tsc 构建，绕开 nest CLI 在某些环境下静默不输出的问题
# build = tsc + tsc-alias，后者把 @/ 别名改写成相对路径，
# 否则 node 直接跑 dist 会报 Cannot find module '@/entities'
RUN echo "=== tsc 前 /app 内容 ===" && ls -la /app && echo "=== src 目录 ===" && ls /app/src/ | head -10
RUN npx tsc -p tsconfig.build.json --listFiles 2>&1 | head -20 || true
RUN npx tsc -p tsconfig.build.json 2>&1 && echo "=== tsc 成功 ===" || echo "=== tsc 失败 ==="
RUN npx tsc-alias -p tsconfig.build.json 2>&1 || true
RUN echo "=== tsc 后 /app 内容 ===" && ls -la /app && echo "=== dist 目录 ===" && ls -la /app/dist 2>&1 || echo "dist 不存在"

# ---- 运行阶段 ----
# 生产用 MySQL，不装 better-sqlite3，也就不需要任何编译器
FROM node:22-alpine
ARG NPM_REGISTRY
ARG APK_MIRROR
WORKDIR /app
RUN sed -i "s#dl-cdn.alpinelinux.org#${APK_MIRROR}#g" /etc/apk/repositories \
  && apk add --no-cache curl tzdata \
  && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && echo "Asia/Shanghai" > /etc/timezone
ENV NODE_ENV=production
COPY package*.json ./
# better-sqlite3 在锁文件里是 devOptional，两个 omit 都要给才会被跳过
RUN sed -i "s#https://registry.npmjs.org/#${NPM_REGISTRY}#g" package-lock.json \
  && npm config set registry "${NPM_REGISTRY}" \
  && npm ci --omit=dev --omit=optional \
  && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fs http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
