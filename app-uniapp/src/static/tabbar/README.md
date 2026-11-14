# tabBar 图标

微信小程序 / App 的原生 tabBar 只支持本地 PNG 图标，不支持 emoji、字体或 SVG。

2026-11-14 起改为 sharp 自动生成，不再手写补图：

- 源文件：scripts/tabbar-svg/{home,local,cart,mine}.svg（24×24 viewBox，stroke=currentColor 的线性图标）
- 生成：`node scripts/gen-tabbar-icons.mjs`
- 输出：本目录 81×81 全套 PNG（灰 #999999 未选中 / 品牌红 #ff4b3a 选中），pages.json 直接引用
