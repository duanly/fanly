/**
 * 共享图标库清单：构建时把 ../../../icons/** 下的所有 SVG 内联进来。
 * 与 h5 端共用仓库根目录的 icons/，新增图标后后台选择器自动出现。
 * 数据库存储格式：icon:local-life/coffee。
 */

// 本文件在 admin/src/components 下，上三级即仓库根 fanly/
const modules = import.meta.glob('../../../icons/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** 单色化：固定 fill/stroke 色统一改成 currentColor，none/currentColor 保留 */
function toMono(svg) {
  return svg
    .replace(/fill="([^"]*)"/gi, (_m, v) =>
      (/^(none|currentColor)$/i.test(v) ? `fill="${v}"` : 'fill="currentColor"'))
    .replace(/stroke="([^"]*)"/gi, (_m, v) =>
      (/^(none|currentColor)$/i.test(v) ? `stroke="${v}"` : 'stroke="currentColor"'));
}

export const ICON_MAP = {};
for (const [path, raw] of Object.entries(modules)) {
  const name = path.replace(/^.*\/icons\//, '').replace(/\.svg$/, '');
  ICON_MAP[name] = toMono(raw);
}

export const ICON_NAMES = Object.keys(ICON_MAP).sort();

/** 按一级目录分组 */
export const ICON_GROUPS = ICON_NAMES.reduce((acc, name) => {
  const i = name.indexOf('/');
  const group = i > 0 ? name.slice(0, i) : 'other';
  (acc[group] ||= []).push(name);
  return acc;
}, {});

export function isIconName(v) {
  return typeof v === 'string' && v.startsWith('icon:');
}
