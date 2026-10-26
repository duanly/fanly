/**
 * 共享图标库清单：构建时把 ../../../icons/*.svg 内联进来（扁平、不分子目录）。
 * 新增/删除图标文件后自动生效，无需注册。
 * 数据库存储格式：icon:coffee；本模块只负责 name → svg 的映射。
 */

const modules = import.meta.glob('../../../icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * SVG 一律保留原始颜色（单色/多色都原样）。
 * 需要在彩色底上变白时，由 AppIcon 传 color 局部覆盖，不改文件。
 */
export const ICON_MAP = {};
for (const [path, raw] of Object.entries(modules)) {
  const name = path.replace(/^.*\/icons\//, '').replace(/\.svg$/, '');
  ICON_MAP[name] = raw;
}

export const ICON_NAMES = Object.keys(ICON_MAP).sort();
