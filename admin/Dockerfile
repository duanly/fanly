FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM alpine:3.20
WORKDIR /dist
COPY --from=builder /app/dist ./
CMD ["sh", "-c", "cp -r /dist/. /out/ && echo '后台静态资源已导出到共享卷' && sleep infinity"]
