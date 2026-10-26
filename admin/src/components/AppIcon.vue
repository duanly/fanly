<template>
  <!-- 统一图标渲染：icon:xxx 走共享 SVG 库；/ 或 http 走图片；其余当 emoji -->
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
  name: { type: String, default: '' },
  size: { type: [Number, String], default: 24 },
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
.app-icon-svg.mono :deep([fill]:not([fill='none']):not([fill='currentColor'])) { fill: currentColor; }
.app-icon-svg.mono :deep([stroke]:not([stroke='none']):not([stroke='currentColor'])) { stroke: currentColor; }
.app-icon-img { width: 100%; height: 100%; object-fit: contain; display: block; }
.app-icon-emoji { line-height: 1; }
</style>
