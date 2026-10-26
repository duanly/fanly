<template>
  <el-dialog
    v-model="visible"
    title="选择图标"
    width="680px"
    append-to-body
    class="icon-picker-dialog"
  >
    <el-input
      v-model="kw"
      placeholder="搜索图标名，如 coffee"
      clearable
      :prefix-icon="Search"
      style="margin-bottom:14px"
    />

    <div class="ip-groups">
      <div class="ip-grid">
        <button
          v-for="n in filteredNames"
          :key="n"
          type="button"
          class="ip-cell"
          :class="{ active: modelValue === 'icon:' + n }"
          :title="n"
          @click="pick(n)"
        >
          <AppIcon :name="'icon:' + n" :size="24" color="#333" />
          <span class="ip-label">{{ n }}</span>
        </button>
      </div>

      <el-empty v-if="!filteredNames.length" description="没有匹配的图标" :image-size="60" />
    </div>

    <template #footer>
      <span class="ip-hint">图标来自共享 icons 目录，把 iconfont 下载的 SVG 放进去后此处自动出现</span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Search } from '@element-plus/icons-vue';
import AppIcon from './AppIcon.vue';
import { ICON_NAMES } from './icon-lib';

const props = defineProps({
  modelValue: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const visible = ref(false);
const kw = ref('');

const filteredNames = computed(() => {
  const k = kw.value.trim().toLowerCase();
  return k ? ICON_NAMES.filter((n) => n.toLowerCase().includes(k)) : ICON_NAMES;
});

function open() {
  kw.value = '';
  visible.value = true;
}
function pick(name) {
  emit('update:modelValue', `icon:${name}`);
  visible.value = false;
}

defineExpose({ open });
</script>

<style scoped>
.ip-groups { max-height: 60vh; overflow-y: auto; }
.ip-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}
.ip-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 4px 8px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all .15s;
}
.ip-cell:hover { border-color: #ffb4ab; background: #fff7f6; }
.ip-cell.active {
  border-color: #ff4b3a;
  background: #fff1ef;
  box-shadow: 0 0 0 1px #ff4b3a inset;
}
.ip-label {
  font-size: 10px;
  color: #999;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ip-hint { color: #bbb; font-size: 12px; }
</style>
