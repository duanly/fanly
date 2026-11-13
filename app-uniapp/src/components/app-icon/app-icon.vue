<template>
  <!-- 统一图标渲染（对齐 H5 AppIcon 的子集，uni 端无 SVG 图标库）：
       / 或 http 开头 → 图片；其他文本 → emoji；空值回退 📦 -->
  <image
    v-if="isImg"
    class="app-icon-img"
    :src="name"
    mode="aspectFill"
    :style="boxStyle"
  />
  <text v-else class="app-icon-emoji" :style="boxStyle">{{ name || '📦' }}</text>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  /** 图片 URL 或 emoji */
  name: { type: String, default: '' },
  /** rpx 数字尺寸，默认 48rpx */
  size: { type: [Number, String], default: 48 },
});

const isImg = computed(() => /^(https?:|\/)/.test(props.name || ''));
const boxStyle = computed(() => {
  const s = typeof props.size === 'number' ? `${props.size}rpx` : props.size;
  return { width: s, height: s, fontSize: s, lineHeight: s };
});
</script>

<style lang="scss" scoped>
.app-icon-img {
  border-radius: 12rpx;
}
.app-icon-emoji {
  text-align: center;
}
</style>
