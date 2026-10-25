<template>
  <div class="m-rules">
    <van-nav-bar
      title="自动回复"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    />

    <div class="tip-bar">
      欢迎语 / 兜底语 / 总开关在 PC 后台「系统参数」配置
      （support.welcome、support.fallback、support.auto_reply）
    </div>

    <div class="add-bar">
      <van-button block round type="primary" color="#ff4b3a" @click="openEdit(null)">
        新增规则
      </van-button>
    </div>

    <div v-for="r in rules" :key="r.id" class="rule-card">
      <div class="rule-head">
        <span class="rule-kw">{{ r.keyword }}</span>
        <van-tag :type="r.matchType === 2 ? 'warning' : 'success'" plain>
          {{ r.matchType === 2 ? '包含' : '精确' }}
        </van-tag>
        <span class="rule-pri">优先级 {{ r.priority }}</span>
        <van-switch :model-value="!!r.enabled" size="18" @change="(v) => toggle(r, v)" />
      </div>
      <div class="rule-reply">{{ r.reply }}</div>
      <div class="rule-actions">
        <van-button size="small" plain type="primary" @click="openEdit(r)">编辑</van-button>
        <van-button size="small" plain type="danger" @click="remove(r)">删除</van-button>
      </div>
    </div>

    <van-empty v-if="!rules.length" description="还没有规则" />

    <!-- 新增/编辑弹层 -->
    <van-popup v-model:show="showEdit" position="bottom" round :style="{ padding: '20px 20px 30px' }">
      <div class="edit-title">{{ form.id ? '编辑规则' : '新增规则' }}</div>
      <van-field v-model="form.keyword" label="关键词" placeholder="如：提现" maxlength="64" />
      <van-field label="匹配方式">
        <template #input>
          <van-radio-group v-model="form.matchType" direction="horizontal">
            <van-radio :name="1">精确</van-radio>
            <van-radio :name="2">包含</van-radio>
          </van-radio-group>
        </template>
      </van-field>
      <van-field
        v-model="form.reply"
        label="回复"
        type="textarea"
        rows="3"
        maxlength="1000"
        show-word-limit
        placeholder="自动回复的内容"
      />
      <van-field v-model="form.priority" label="优先级" type="number" placeholder="越大越优先" />
      <van-button
        block
        round
        type="primary"
        color="#ff4b3a"
        style="margin-top:16px"
        @click="save"
      >保存</van-button>
    </van-popup>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { showConfirmDialog, showSuccessToast, showToast } from 'vant';
import { adminApi } from '../../api';

const rules = ref([]);
const showEdit = ref(false);
const form = ref({ id: null, keyword: '', matchType: 2, reply: '', priority: 0 });

async function load() {
  rules.value = await adminApi.supportRules();
}

function openEdit(r) {
  form.value = r
    ? {
        id: r.id, keyword: r.keyword, matchType: r.matchType,
        reply: r.reply, priority: r.priority,
      }
    : { id: null, keyword: '', matchType: 2, reply: '', priority: 0 };
  showEdit.value = true;
}

async function save() {
  const f = form.value;
  if (!f.keyword.trim()) return showToast('请填关键词');
  if (!f.reply.trim()) return showToast('请填回复内容');
  const body = { ...f, priority: Number(f.priority) || 0 };
  if (f.id) await adminApi.supportRuleUpdate(f.id, body);
  else await adminApi.supportRuleCreate(body);
  showSuccessToast('已保存');
  showEdit.value = false;
  load();
}

async function toggle(r, enabled) {
  await adminApi.supportRuleUpdate(r.id, { enabled });
  r.enabled = enabled;
}

async function remove(r) {
  try {
    await showConfirmDialog({ title: '删除规则', message: `确定删除「${r.keyword}」？` });
    await adminApi.supportRuleRemove(r.id);
    showSuccessToast('已删除');
    load();
  } catch (e) {
    if (e === 'cancel') return;
  }
}

onMounted(load);
</script>

<style scoped>
.m-rules { min-height: 100vh; background: #f5f6f8; padding-bottom: 30px; }
.tip-bar {
  margin: 10px 12px;
  padding: 9px 12px;
  background: #fff7e6;
  border-radius: 8px;
  font-size: 12px;
  color: #ad6800;
  line-height: 1.6;
}
.add-bar { margin: 4px 12px 12px; }

.rule-card {
  background: #fff;
  margin: 0 12px 10px;
  border-radius: 12px;
  padding: 12px 14px;
}
.rule-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rule-kw { font-size: 15px; font-weight: 700; color: #1a1a1a; }
.rule-pri {
  margin-left: auto;
  font-size: 11px;
  color: #bbb;
}
.rule-reply {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rule-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.edit-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 12px;
}
</style>
