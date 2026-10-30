# tabBar 图标

微信小程序 / App 的原生 tabBar 只支持本地 PNG 图标，不支持 emoji、字体或 base64。

需要补 8 张 PNG（建议 81×81px，透明底）：

- home.png / home-on.png      首页（灰 / 红）
- local.png / local-on.png    本地生活
- cart.png / cart-on.png      收藏夹
- mine.png / mine-on.png      我的

补齐前可临时在 pages.json 删掉每项的 iconPath/selectedIconPath（只剩文字 tab 也能运行）。
