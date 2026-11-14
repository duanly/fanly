<template>
  <!-- 管理台列表排序栏：左选字段、右选升降序，服务端排序（分页数据不能前端排） -->
  <van-dropdown-menu active-color="#ff4b3a" class="admin-sort-bar">
    <van-dropdown-item
      :model-value="sortBy"
      :options="options"
      @change="(v) => emitChange(v, sortOrder)"
    />
    <van-dropdown-item
      :model-value="sortOrder"
      :options="dirOptions"
      @change="(v) => emitChange(sortBy, v)"
    />
  </van-dropdown-menu>
</template>

<script setup>
const dirOptions = [
  { text: '降序', value: 'desc' },
  { text: '升序', value: 'asc' },
];

const props = defineProps({
  // [{ text: '注册时间', value: 'createdAt' }, ...]，value 必须是后端白名单字段
  options: { type: Array, required: true },
  sortBy: { type: String, required: true },
  sortOrder: { type: String, default: 'desc' },
});
const emit = defineEmits(['change']);

function emitChange(sortBy, sortOrder) {
  emit('change', { sortBy, sortOrder });
}
</script>

<style scoped>
.admin-sort-bar {
  box-shadow: none;
  border-bottom: 1px solid #eee;
}
.admin-sort-bar :deep(.van-dropdown-menu__bar) {
  box-shadow: none;
  height: 40px;
}
.admin-sort-bar :deep(.van-dropdown-menu__title) {
  font-size: 13px;
}
</style>
