<template>
  <!-- 统一图标渲染，兼容三种存量数据：
       icon:xxx  → 共享图标库 SVG（颜色随 color / 字号）
       / 或 http 开头 → 图片
       其他文本 → 当作 emoji 直接显示 -->
  <span class="app-icon" :class="{ dot: !!dotProp }" :style="boxStyle">
    <img v-if="kind.type === 'img'" class="app-icon-img" :src="name" alt="" />
    <span
      v-else-if="kind.type === 'svg' && svgHtml"
      class="app-icon-svg"
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
  /** 图标颜色（仅对图标自身用 currentColor 的 SVG 生效） */
  color: { type: String, default: '' },
  /** 半透明白色圆形底托：彩色渐变底上衬托原色图标 */
  dot: { type: Boolean, default: false },
});
const dotProp = computed(() => props.dot);

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
/* 半透明白色圆托：原色图标缩到约 72% 居中 */
.app-icon.dot {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
}
.app-icon.dot .app-icon-svg,
.app-icon.dot .app-icon-img,
.app-icon.dot .app-icon-emoji { width: 72%; height: 72%; font-size: 72%; }
.app-icon-svg { display: inline-flex; width: 100%; height: 100%; }
.app-icon-svg :deep(svg) { width: 100%; height: 100%; display: block; }
/* SVG 始终保留文件内原始颜色（iconfont 的红绿等），不用 CSS 覆盖；
   仅当图标本身用 currentColor 时才跟随容器 color */
.app-icon-img { width: 100%; height: 100%; object-fit: contain; display: block; }
.app-icon-emoji { line-height: 1; }
</style>
