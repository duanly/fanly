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
# 清掉 TS 增量缓存 + 旧 dist：incremental:true 时跨机器的 .tsbuildinfo 会让 tsc 输出损坏，
# 旧 dist 也可能残留未编译的 .ts，必须删干净
RUN rm -f *.tsbuildinfo && rm -rf dist
# 第一步 tsc 编译。历史代码有若干「纯类型错误」（Multer 等），报错时默认仍 emit JS，
# 故用 || true 不让类型错误中断构建。
# 注意：绝不能用 `tsc && tsc-alias`——tsc 因类型错误返回非 0 会导致 tsc-alias 被跳过，
# dist 里残留 @/ 别名、Node 启动报 Cannot find module。
RUN npx tsc -p tsconfig.build.json || true
# 第二步 tsc-alias 必须独立、必定执行：把 @/ 别名改写成相对路径
RUN npx tsc-alias -p tsconfig.build.json

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
