# 省钱猫 · uni-app 多端客户端

一套代码（Vue3 + uni-app）发行：**H5 / 微信小程序 / iOS / Android**。
接口与旧版 H5（`h5/`）1:1 对齐，后端无需改动。

## 本地调试

```bash
cd app-uniapp

# 1. 生成 tabBar 的 8 张 PNG（零依赖脚本，已纳入 pages.json 路径）
node scripts/gen-tabbar-icons.mjs

# 2. 安装依赖
npm install

# 3. 起 H5（默认走 manifest.json 里的代理 → https://fanly.lyelse.com）
npm run dev:h5
```

其他端：

```bash
npm run dev:mp-weixin   # 然后用微信开发者工具导入 dist/dev/mp-weixin
npm run build:h5        # 产物在 dist/build/h5
npm run build:mp-weixin # 小程序生产包
```

## 页面清单（src/pages，共 27 个，均已实现）

| 分区 | 页面 |
| --- | --- |
| 主 tab | home（热销/返利/推荐三榜）、local-life（聚推客活动）、cart（收藏夹）、mine |
| 账户 | login（登录/注册双 tab）、change-password、realname |
| 商品 | goods/detail、search、parse（转链查返利）、category、group（运营专区）、topic（专题） |
| 订单 | orders（状态 tabs）、claim（订单找回） |
| 资金 | fund/balance（汇总+流水）、fund/withdraw（提现）、fund/payment-method（微信/支付宝收款码） |
| 代理 | agent（等级/业绩/二级团队）、agent/invite（推广码）、agent/team、agent/ledger |
| 工具 | compare（全网比价）、compare/detail、support（在线客服） |

## 关键取舍（小程序合规）

- **成交链路走剪贴板**：小程序不能唤起淘宝/京东/拼多多 App，领券购买统一复制口令/链接，弹窗提示去对应 App 打开。
- **平台授权**（拼多多等）：`pages/auth/auth`，三端条件编译——H5 跳转、App 用 `plus.runtime.openURL`、小程序复制链接到浏览器。
- **客服 IM**：小程序不兼容 socket.io 协议，`support` 页先用 **4 秒轮询** `/api/support/conversation` 保证三端可用；后续可换 `wx.connectSocket` 原生 WS 或腾讯云 IM。
- 收款码上传复用 `/api/auth/avatar` 接口（与旧 H5 一致）。

## 上线前待配置

1. `src/manifest.json`：填入微信小程序 `mp-weixin.appid`；App 端 appid。
2. 微信公众平台后台：把 `https://fanly.lyelse.com` 加入 **request 合法域名**、uploadFile 合法域名。
3. iOS：隐私清单、权限文案、账号注销入口（应对 4.2 审核）。
4. Android：targetSdk 34、运行时权限、软著。
