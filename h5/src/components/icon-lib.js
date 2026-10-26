/**
 * 共享图标库清单：构建时把 ../../../icons/** 下的所有 SVG 内联进来。
 * 新增/删除图标文件后自动生效，无需注册。
 * 数据库存储格式：icon:local-life/coffee；本模块只负责 name → svg 的映射。
 */

// 本文件在 h5/src/components 下，上三级即仓库根 fanly/，与 admin 共用同一份 icons
const modules = import.meta.glob('../../../icons/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * SVG 一律保留原始颜色（单色/多色都原样）。
 * 需要在彩色底上变白时，由 AppIcon 传 color 局部覆盖，不改这里的文件。
 */
export const ICON_MAP = {};
for (const [path, raw] of Object.entries(modules)) {
  const name = path.replace(/^.*\/icons\//, '').replace(/\.svg$/, '');
  ICON_MAP[name] = raw;
}

export const ICON_NAMES = Object.keys(ICON_MAP).sort();

/** 按一级目录分组：{ 'local-life': ['local-life/coffee', ...], common: [...] } */
export const ICON_GROUPS = ICON_NAMES.reduce((acc, name) => {
  const i = name.indexOf('/');
  const group = i > 0 ? name.slice(0, i) : 'other';
  (acc[group] ||= []).push(name);
  return acc;
}, {});

export function isIconName(v) {
  return typeof v === 'string' && v.startsWith('icon:');
}
