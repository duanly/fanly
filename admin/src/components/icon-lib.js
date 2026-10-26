/**
 * 共享图标库清单：构建时把 ../../../icons/*.svg 内联进来（扁平、不分子目录）。
 * 与 h5 端共用仓库根目录的 icons/，新增图标后后台选择器自动出现。
 * 数据库存储格式：icon:coffee。
 */

const modules = import.meta.glob('/@icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// SVG 保留原始颜色；需要变白/变色时由 AppIcon 传 color 局部覆盖
export const ICON_MAP = {};
for (const [path, raw] of Object.entries(modules)) {
  const name = path.replace(/^.*\/icons\//, '').replace(/\.svg$/, '');
  ICON_MAP[name] = raw;
}

export const ICON_NAMES = Object.keys(ICON_MAP).sort();
