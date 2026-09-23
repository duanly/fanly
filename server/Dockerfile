# ---- 构建阶段 ----
FROM node:22-alpine AS builder
WORKDIR /app
# better-sqlite3 等原生模块在 alpine 上要编译
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ curl tzdata \
  && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && echo "Asia/Shanghai" > /etc/timezone
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fs http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
