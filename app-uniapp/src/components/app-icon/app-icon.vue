<template>
  <!-- 统一图标渲染，规则与 H5 AppIcon.vue 对齐：
       icon:xxx 或裸文件名（xxx / xxx.svg，且在图标库清单内）→ 图标库 PNG
       / 或 http 开头 → 图片
       其他文本 → emoji
       icon:xxx 但库里找不到 → 📦 兜底，绝不把英文 key 露给用户 -->
  <image
    v-if="kind.type === 'img'"
    class="app-icon-img"
    :src="resolveImg(kind.src)"
    mode="aspectFit"
    :style="boxStyle"
  />
  <text v-else-if="kind.type === 'emoji'" class="app-icon-emoji" :style="boxStyle">{{ kind.text }}</text>
  <text v-else class="app-icon-emoji" :style="boxStyle">📦</text>
</template>

<script setup>
import { computed } from 'vue';
import { ICON_NAMES } from './icon-names.js';
import { resolveImg } from '../../utils/url.js';

const props = defineProps({
  /** 图标库引用 icon:xx、图片 URL、或 emoji */
  name: { type: String, default: '' },
  /** rpx 数字尺寸，默认 48rpx */
  size: { type: [Number, String], default: 48 },
});

const boxStyle = computed(() => {
  const s = typeof props.size === 'number' ? `${props.size}rpx` : props.size;
  return { width: s, height: s, fontSize: s, lineHeight: s };
});

const kind = computed(() => {
  const v = (props.name || '').trim();
  if (!v) return { type: 'emoji', text: '📦' };

  // icon:xxx → 图标库
  if (v.startsWith('icon:')) {
    const key = v.slice(5);
    return ICON_NAMES.includes(key)
      ? { type: 'img', src: `/static/icons/lib/${key}.png` }
      : { type: 'unknown' };
  }

  // 裸文件名（coffee / coffee.svg）在清单内 → 图标库，避免被当成 emoji 显示英文
  const bare = v.replace(/\.svg$/i, '');
  if (/^[a-z0-9_-]+(\.svg)?$/i.test(v) && ICON_NAMES.includes(bare)) {
    return { type: 'img', src: `/static/icons/lib/${bare}.png` };
  }

  // 图片地址（绝对路径或外链）
  if (/^(https?:)?\/\//.test(v) || v.startsWith('/')) {
    return { type: 'img', src: v };
  }

  // 其余按 emoji 处理
  return { type: 'emoji', text: v };
});
</script>

<style lang="scss" scoped>
.app-icon-img {
  flex-shrink: 0;
}
.app-icon-emoji {
  text-align: center;
  flex-shrink: 0;
}
</style>
