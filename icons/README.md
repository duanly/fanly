# 平台共享图标库

h5 和 admin 两个前端共用这一份 SVG 图标。从 [iconfont](https://www.iconfont.cn)
下载单色 SVG 后，直接按分类丢进对应文件夹即可，**无需改代码、无需重新注册**，
后台「选择图标」弹窗里会自动出现。

## 目录约定

按用途分子目录，文件名即图标名（全小写、单词用连字符）：

```
icons/
  local-life/      # 本地生活分类：餐饮、奶茶、酒店、打车…
  common/          # 通用：礼物、客服、箭头…
  category/        # 电商品类（按需自建）
```

引用名 = 相对 icons 的路径去掉扩展名，例如：

- `local-life/coffee.svg` → `local-life/coffee`
- `common/gift.svg`       → `common/gift`

数据库里存的时候带前缀 `icon:`，例如 `icon:local-life/coffee`。

## 从 iconfont 下载的正确姿势

1. iconfont 选好图标 → 「下载素材」→ 选 **SVG**
2. 文件名改成英文小写短横线（如 `milk-tea.svg`），丢进对应目录
3. 单色图标即可：组件会自动把图标颜色处理成 `currentColor`，
   大小跟随字号、颜色跟随 CSS `color`，能跟各处主题色联动
4. 不要下载多色/渐变 SVG（会被统一成单色）；多色 Logo 请走图片上传

## 尺寸

图标统一按 `viewBox="0 0 24 24"`（或正方形 viewBox）绘制，
组件用 `size` 属性控制实际像素（默认 24）。

## 新增分类

直接新建子目录即可，后台图标选择器会自动按目录分组显示。
