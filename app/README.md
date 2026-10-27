# 省钱猫 App（Flutter）

淘宝/京东/拼多多/唯品会 CPS 导购的 iOS / Android 原生客户端，与 H5（`../h5`）共用同一套后端接口。

## 一、环境准备（仅首次）

1. 安装 Flutter stable（含 Dart）、Xcode + CocoaPods（iOS）、Android Studio（安卓）
2. 校验：

```bash
flutter doctor
```

全部打勾后继续。

## 二、生成原生工程（仅首次）

`lib/`、`pubspec.yaml` 已在仓库中，但 iOS/Android 原生壳由 Flutter 生成。
**在 `app/` 目录内**执行（不会覆盖已有的 `lib/` 和 `pubspec.yaml`，只补齐缺失的平台目录）：

```bash
cd app
flutter create --org com.fanly --project-name fanli .
flutter pub get
```

## 三、运行

后端地址通过 `--dart-define=API_BASE` 注入（不写死域名）：

```bash
# iOS 模拟器（localhost 即宿主机）
flutter run --dart-define=API_BASE=http://localhost:3000

# Android 模拟器（访问宿主机用 10.0.2.2）
flutter run --dart-define=API_BASE=http://10.0.2.2:3000

# 真机 / 测试环境 / 生产（用 https 域名）
flutter run --dart-define=API_BASE=https://你的后端域名
```

不指定时默认 `http://localhost:3000`（见 `lib/core/config/app_config.dart`）。

## 四、目录结构

```
lib/
  main.dart            入口：bootstrap 本地 token、注入 401 处理
  app.dart             MaterialApp.router + 主题
  core/
    config/            环境配置（API_BASE）
    http/              dio 封装（鉴权/统一信封解包/401）、api 接口表
    router/            go_router + 登录守卫
    storage/           token 安全存储（Keychain/Keystore）
    theme/             品牌色、主题
    utils/             比例、金额等工具
    widgets/           通用组件、启动屏
  features/
    auth/              登录、注册、登录态
    home/ goods/       首页/分类/转链（阶段 1 完善）
    profile/           我的
    （后续阶段补 order/fund/agent/checkin/local_life/support）
```

## 五、分阶段路线

- 阶段 0（当前）：工程地基、主题、网络、安全存储、路由守卫、登录注册、4 Tab 骨架
- 阶段 1：首页全模块、商品详情、转链唤起、搜索、分类、专题
- 阶段 2：我的、订单、订单找回、资金/提现、实名（相机相册）、剪贴板、生物识别
- 阶段 3：邀请、代理、签到、本地生活、客服 IM、购物车、比价
- 阶段 4：图标/启动图、权限文案、协议页、注销入口、iOS/Android 上架配置、出包

## 六、打包（阶段 4 详述）

```bash
flutter build ios --release --dart-define=API_BASE=https://你的域名
flutter build apk --release --dart-define=API_BASE=https://你的域名
```
