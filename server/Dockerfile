# ---- 构建阶段 ----
FROM node:22-alpine AS builder
WORKDIR /app
# 换国内源：apk 走腾讯云内网，npm 走淘宝源
# 非腾讯云环境把 mirrors.tencentyun.com 换成 mirrors.aliyun.com
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tencentyun.com#g' /etc/apk/repositories \
  && apk add --no-cache python3 make g++
COPY package*.json ./
# package-lock.json 里记死了 npmjs.org 的下载地址，光设 registry 不生效，要一起替换
RUN sed -i 's#https://registry.npmjs.org/#https://registry.npmmirror.com/#g' package-lock.json \
  && npm config set registry https://registry.npmmirror.com \
  && npm ci
COPY . .
# build = nest build + tsc-alias，后者把 @/ 路径别名改写成相对路径，
# 否则 node 直接跑 dist 会报 Cannot find module '@/entities'
RUN npm run build

# ---- 运行阶段 ----
# 生产用 MySQL，不装 better-sqlite3，也就不需要任何编译器
FROM node:22-alpine
WORKDIR /app
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tencentyun.com#g' /etc/apk/repositories \
  && apk add --no-cache curl tzdata \
  && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && echo "Asia/Shanghai" > /etc/timezone
ENV NODE_ENV=production
COPY package*.json ./
# better-sqlite3 在锁文件里是 devOptional，两个 omit 都要给才会被跳过
RUN sed -i 's#https://registry.npmjs.org/#https://registry.npmmirror.com/#g' package-lock.json \
  && npm config set registry https://registry.npmmirror.com \
  && npm ci --omit=dev --omit=optional \
  && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fs http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
