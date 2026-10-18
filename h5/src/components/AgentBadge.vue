<template>
  <span class="agent-badge" :class="['level-' + level, { mini }]">
    <span class="badge-ico">{{ badgeIcon }}</span>
    <span class="badge-text">{{ badgeName }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  level: { type: Number, default: 0 },
  mini: { type: Boolean, default: false },
});

const LEVELS = {
  0: { name: '预备代理', icon: '🎯', color: '#999' },
  1: { name: '白银代理', icon: '🥈', color: '#a0a0a0' },
  2: { name: '黄金代理', icon: '🥇', color: '#ff976a' },
  3: { name: '钻石代理', icon: '💎', color: '#00a8ff' },
};

const badgeIcon = computed(() => LEVELS[props.level]?.icon || '🎯');
const badgeName = computed(() => LEVELS[props.level]?.name || '预备代理');
</script>

<style scoped>
.agent-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: linear-gradient(135deg, #fff5f0, #fff0e8);
  color: #ff6b35;
  border: 1px solid #ffd5c2;
  line-height: 1.4;
}
.agent-badge.mini {
  padding: 1px 6px;
  font-size: 10px;
  gap: 2px;
}
.badge-ico {
  font-size: 12px;
}
.agent-badge.mini .badge-ico {
  font-size: 11px;
}
.agent-badge.level-0 {
  background: #f5f5f5;
  color: #999;
  border-color: #e5e5e5;
}
.agent-badge.level-1 {
  background: linear-gradient(135deg, #f8f8f8, #ececec);
  color: #666;
  border-color: #d0d0d0;
}
.agent-badge.level-2 {
  background: linear-gradient(135deg, #fff7e6, #ffedcc);
  color: #c77700;
  border-color: #ffd66b;
}
.agent-badge.level-3 {
  background: linear-gradient(135deg, #e6f4ff, #bce0ff);
  color: #0066cc;
  border-color: #99ccff;
}
</style>
