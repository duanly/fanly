<template>
  <!-- 统一图标渲染，兼容三种存量数据：
       icon:xxx  → 共享图标库 SVG（颜色随 color / 字号）
       / 或 http 开头 → 图片
       其他文本 → 当作 emoji 直接显示 -->
  <span class="app-icon" :style="boxStyle">
    <img v-if="kind.type === 'img'" class="app-icon-img" :src="name" alt="" />
    <span
      v-else-if="kind.type === 'svg' && svgHtml"
      class="app-icon-svg"
      :class="{ mono: !!color }"
      v-html="svgHtml"
    ></span>
    <span v-else-if="kind.type === 'emoji'" class="app-icon-emoji">{{ name }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { ICON_MAP } from './icon-lib';

const props = defineProps({
  /** 图标库引用 icon:xx、图片 URL、或 emoji */
  name: { type: String, default: '' },
  /** 像素数字或任意 CSS 尺寸，默认 24 */
  size: { type: [Number, String], default: 24 },
  /** 图标颜色（仅对图标库单色 SVG 生效） */
  color: { type: String, default: '' },
});

const px = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size));

const boxStyle = computed(() => ({
  width: px.value,
  height: px.value,
  fontSize: px.value,
  color: props.color || undefined,
}));

const kind = computed(() => {
  const v = props.name || '';
  if (v.startsWith('icon:')) return { type: 'svg', key: v.slice(5) };
  if (/^(https?:)?\/\//.test(v) || v.startsWith('/')) return { type: 'img' };
  return { type: 'emoji' };
});

const svgHtml = computed(() =>
  kind.value.type === 'svg' ? ICON_MAP[kind.value.key] || '' : '',
);
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  vertical-align: middle;
  flex: 0 0 auto;
}
.app-icon-svg { display: inline-flex; width: 100%; height: 100%; }
.app-icon-svg :deep(svg) { width: 100%; height: 100%; display: block; }
/* 传了 color 时局部压成单色（彩色渐变底上的白图标）；fill/stroke=none 保留 */
.app-icon-svg.mono :deep([fill]:not([fill='none']):not([fill='currentColor'])) { fill: currentColor; }
.app-icon-svg.mono :deep([stroke]:not([stroke='none']):not([stroke='currentColor'])) { stroke: currentColor; }
.app-icon-img { width: 100%; height: 100%; object-fit: contain; display: block; }
.app-icon-emoji { line-height: 1; }
</style>
