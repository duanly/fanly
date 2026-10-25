<template>
  <el-card shadow="never">
    <el-tabs v-model="tab">
      <!-- ============ 客服会话 ============ -->
      <el-tab-pane label="客服会话" name="chat">
        <div class="support-layout">
          <!-- 左：客户列表 -->
          <div class="conv-list">
            <el-input
              v-model="keyword"
              placeholder="搜手机号 / 昵称"
              size="small"
              clearable
              style="margin-bottom:8px"
              @keyup.enter="loadConversations"
              @clear="loadConversations"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <div class="conv-scroll">
              <div
                v-for="c in conversations"
                :key="c.id"
                class="conv-item"
                :class="{ active: currentId === c.id }"
                @click="openConv(c)"
              >
                <el-avatar :src="c.avatar || undefined" :size="42">{{ (c.nickname || '客')[0] }}</el-avatar>
                <div class="conv-main">
                  <div class="conv-top">
                    <span class="conv-name">{{ c.nickname || '未设置昵称' }}</span>
                    <span class="conv-time">{{ fmtConvTime(c.lastMessageAt) }}</span>
                  </div>
                  <div class="conv-bottom">
                    <span class="conv-last">{{ c.lastMessageType === 2 ? '[图片]' : (c.lastMessage || '—') }}</span>
                    <el-badge v-if="c.staffUnread > 0" :value="c.staffUnread" :max="99" />
                  </div>
                  <div class="conv-mobile">{{ c.mobile }}</div>
                </div>
              </div>
              <el-empty v-if="!conversations.length" description="暂无会话" :image-size="60" />
            </div>
          </div>

          <!-- 右：聊天窗口 -->
          <div class="chat-pane">
            <template v-if="current">
              <div class="chat-head">
                <b>{{ current.user.nickname || '未设置昵称' }}</b>
                <span class="muted" style="margin-left:10px">{{ current.user.mobile }}</span>
              </div>

              <div ref="msgListRef" class="chat-msgs">
                <div
                  v-for="m in current.messages"
                  :key="m.id"
                  class="chat-row"
                  :class="m.senderType === 1 ? 'from-user' : 'from-staff'"
                >
                  <div class="bubble" :class="{ image: m.type === 2, auto: m.senderType === 3 }">
                    <div v-if="m.senderType === 3" class="auto-tag">自动回复</div>
                    <el-image
                      v-if="m.type === 2"
                      :src="m.content"
                      :preview-src-list="[m.content]"
                      fit="cover"
                      preview-teleported
                      class="msg-img"
                    />
                    <template v-else>{{ m.content }}</template>
                  </div>
                </div>
              </div>

              <div class="chat-input">
                <el-upload
                  :show-file-list="false"
                  :before-upload="beforeImageUpload"
                  accept="image/*"
                >
                  <el-button :icon="Picture" circle title="发图片" />
                </el-upload>
                <el-input
                  v-model="draft"
                  type="textarea"
                  :rows="2"
                  resize="none"
                  placeholder="输入回复，Enter 发送，Shift+Enter 换行"
                  @keydown.enter.exact.prevent="send"
                />
                <el-button type="primary" :loading="sending" @click="send">发送</el-button>
              </div>
            </template>
            <el-empty v-else description="选择左侧会话开始回复" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 自动回复规则 ============ -->
      <el-tab-pane label="自动回复" name="rules">
        <div class="rules-head">
          <el-button type="primary" @click="openRule(null)">新增规则</el-button>
          <el-alert
            type="info"
            :closable="false"
            style="margin-left:14px;flex:1"
            title="欢迎语 / 未命中兜底语 / 自动回复总开关，请在「系统参数」页配置：support.welcome、support.fallback、support.auto_reply"
          />
        </div>

        <el-table :data="rules" v-loading="rulesLoading" style="margin-top:12px">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="keyword" label="关键词" width="140" />
          <el-table-column label="匹配方式" width="100">
            <template #default="{ row }">
              <el-tag :type="row.matchType === 2 ? 'warning' : 'success'" size="small">
                {{ row.matchType === 2 ? '包含' : '精确' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reply" label="回复内容" min-width="260" show-overflow-tooltip />
          <el-table-column prop="priority" label="优先级" width="80" />
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-switch
                :model-value="!!row.enabled"
                @change="(v) => toggleRule(row, v)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" link @click="openRule(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="removeRule(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 规则编辑弹窗 -->
    <el-dialog v-model="ruleDialog" :title="ruleForm.id ? '编辑规则' : '新增规则'" width="520px">
      <el-form label-width="84px">
        <el-form-item label="关键词">
          <el-input v-model="ruleForm.keyword" maxlength="64" show-word-limit placeholder="如：提现" />
        </el-form-item>
        <el-form-item label="匹配方式">
          <el-radio-group v-model="ruleForm.matchType">
            <el-radio :value="1">精确匹配（用户输入完全一致）</el-radio>
            <el-radio :value="2">包含匹配（消息里出现即可）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="回复内容">
          <el-input v-model="ruleForm.reply" type="textarea" :rows="4" maxlength="1000" show-word-limit />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="ruleForm.priority" :min="0" :max="9999" />
          <span class="muted" style="margin-left:10px">数值越大越先匹配</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialog = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Picture, Search } from '@element-plus/icons-vue';
import { io } from 'socket.io-client';
import { api } from '../api';

const tab = ref('chat');

// ---- 会话列表 ----
const keyword = ref('');
const conversations = ref([]);
const current = ref(null);
const currentId = ref(null);
const draft = ref('');
const sending = ref(false);
const msgListRef = ref(null);
let socket = null;

function fmtConvTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

async function loadConversations() {
  const r = await api.supportConversations({
    keyword: keyword.value || undefined,
    page: 1,
    size: 50,
  });
  conversations.value = r.list || [];
}

/** 列表项置顶/更新，保持顺序正确 */
function upsertConversation(c) {
  const i = conversations.value.findIndex((x) => x.id === c.id);
  const prev = i >= 0 ? conversations.value[i] : {};
  if (i >= 0) conversations.value.splice(i, 1);
  conversations.value.unshift({ ...prev, ...c });
}

async function openConv(c) {
  const detail = await api.supportDetail(c.id);
  current.value = detail;
  currentId.value = c.id;
  nextTick(scrollMsgs);
  // 服务端打开即已读（同时也会推 support:conversation 兜底多端同步）
  upsertConversation(detail.conversation);
}

function scrollMsgs() {
  const el = msgListRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function send() {
  const content = draft.value.trim();
  if (!content || !currentId.value || sending.value) return;
  sending.value = true;
  try {
    const r = await api.supportSend(currentId.value, 1, content);
    appendMessage(r.message);
    upsertConversation(r.conversation);
    draft.value = '';
  } finally {
    sending.value = false;
  }
}

/** el-upload 的手动上传：拿 url 后发图片消息；返回 false 阻止组件自带上传 */
async function beforeImageUpload(file) {
  try {
    const up = await api.uploadImage(file);
    const r = await api.supportSend(currentId.value, 2, up.url);
    appendMessage(r.message);
    upsertConversation(r.conversation);
  } catch {
    ElMessage.error('图片发送失败');
  }
  return false;
}

function appendMessage(m) {
  if (!current.value) return;
  if (current.value.messages.some((x) => x.id === m.id)) return;
  current.value.messages.push(m);
  nextTick(scrollMsgs);
}

// ---- 自动回复规则 ----
const rules = ref([]);
const rulesLoading = ref(false);
const ruleDialog = ref(false);
const ruleForm = ref({ id: null, keyword: '', matchType: 2, reply: '', priority: 0 });

async function loadRules() {
  rulesLoading.value = true;
  try {
    rules.value = await api.supportRules();
  } finally {
    rulesLoading.value = false;
  }
}

function openRule(row) {
  ruleForm.value = row
    ? { ...row }
    : { id: null, keyword: '', matchType: 2, reply: '', priority: 0 };
  ruleDialog.value = true;
}

async function saveRule() {
  const f = ruleForm.value;
  if (!f.keyword.trim()) return ElMessage.warning('请填关键词');
  if (!f.reply.trim()) return ElMessage.warning('请填回复内容');
  if (f.id) await api.supportRuleUpdate(f.id, f);
  else await api.supportRuleCreate(f);
  ElMessage.success('已保存');
  ruleDialog.value = false;
  loadRules();
}

async function removeRule(row) {
  await ElMessageBox.confirm(`确定删除规则「${row.keyword}」？`, '删除规则', { type: 'warning' });
  await api.supportRuleRemove(row.id);
  ElMessage.success('已删除');
  loadRules();
}

async function toggleRule(row, enabled) {
  await api.supportRuleUpdate(row.id, { enabled });
  row.enabled = enabled;
}

// ---- 生命周期 ----
onMounted(() => {
  loadConversations();
  loadRules();

  socket = io({
    auth: { token: localStorage.getItem('adminToken') },
    transports: ['websocket', 'polling'],
  });
  socket.on('support:message', ({ message, conversation }) => {
    if (!conversation) return;
    upsertConversation(conversation);
    if (currentId.value === conversation.id) appendMessage(message);
  });
  socket.on('support:conversation', ({ conversation }) => {
    if (conversation) upsertConversation(conversation);
  });
});

onUnmounted(() => {
  socket?.disconnect();
  socket = null;
});
</script>

<style scoped>
.muted { color: #999; font-size: 12px; }

/* 双栏布局 */
.support-layout {
  display: flex;
  height: calc(100vh - 190px);
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}
.conv-list {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid #ebeef5;
  padding: 10px;
  display: flex;
  flex-direction: column;
}
.conv-scroll {
  flex: 1;
  overflow-y: auto;
}
.conv-item {
  display: flex;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.conv-item:hover { background: #f5f7fa; }
.conv-item.active { background: #fff1ef; }
.conv-main { flex: 1; min-width: 0; }
.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.conv-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-time { font-size: 11px; color: #bbb; flex-shrink: 0; }
.conv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.conv-last {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.conv-mobile { font-size: 11px; color: #c0c4cc; margin-top: 2px; }

/* 聊天窗 */
.chat-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-head {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}
.chat-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f5f7fa;
}
.chat-row { display: flex; margin-bottom: 14px; }
.chat-row.from-user { justify-content: flex-start; }
.chat-row.from-staff { justify-content: flex-end; }
.bubble {
  max-width: 60%;
  padding: 9px 13px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.from-staff .bubble {
  background: #ff4b3a;
  color: #fff;
  border-top-right-radius: 3px;
}
.from-user .bubble { border-top-left-radius: 3px; }
.bubble.auto {
  background: #f4f4f5;
  color: #606266;
}
.auto-tag {
  font-size: 10px;
  color: #909399;
  margin-bottom: 2px;
}
.bubble.image { padding: 3px; background: transparent; box-shadow: none; }
.msg-img {
  width: 200px;
  max-width: 30vw;
  height: 150px;
  border-radius: 8px;
  cursor: pointer;
}

.chat-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid #ebeef5;
  background: #fff;
}
.chat-input .el-textarea { flex: 1; }

.rules-head { display: flex; align-items: center; }
</style>
