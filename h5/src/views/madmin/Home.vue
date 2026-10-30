<template>
  <div class="madmin-home">
    <!-- 顶部数据概览 -->
    <div class="header">
      <div class="header-top">
        <div class="title">运营中心</div>
        <div class="logout" @click="onLogout">
          <van-icon name="log-out" />
        </div>
      </div>
      <div class="stats">
        <div class="stat-item">
          <div class="stat-num">{{ stats.onShelf || 0 }}</div>
          <div class="stat-label">已上架</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.pending || 0 }}</div>
          <div class="stat-label">待上架</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.offShelf || 0 }}</div>
          <div class="stat-label">已下架</div>
        </div>
      </div>
    </div>

    <!-- 功能入口 -->
    <div class="section">
      <div class="grid">
        <div class="grid-item" @click="$router.push('/madmin/search')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#667eea,#764ba2)">
            <van-icon name="search" />
          </div>
          <div class="grid-name">找商品</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/pool')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#f093fb,#f5576c)">
            <van-icon name="shop-collect-o" />
          </div>
          <div class="grid-name">选品池</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/tags')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#4facfe,#00f2fe)">
            <van-icon name="label-o" />
          </div>
          <div class="grid-name">标签管理</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/orders')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#fa709a,#fee140)">
            <van-icon name="orders-o" />
          </div>
          <div class="grid-name">订单</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/jtk')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#ff9500,#ff6b35)">
            <van-icon name="shopping-cart-o" />
          </div>
          <div class="grid-name">聚推客</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/users')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#667eea,#764ba2)">
            <van-icon name="user-o" />
          </div>
          <div class="grid-name">用户</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/agents')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#a8edea,#fed6e3)">
            <van-icon name="friends-o" />
          </div>
          <div class="grid-name">代理</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/withdraws')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#30cfd0,#330867)">
            <van-icon name="gold-coin-o" />
          </div>
          <div class="grid-name">提现审核</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/realnames')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#84fab0,#8fd3f4)">
            <van-icon name="contact" />
          </div>
          <div class="grid-name">实名审核</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/support')">
          <div class="grid-ico support-ico-wrap" style="background: linear-gradient(135deg,#43cea2,#185a9d)">
            <van-icon name="service-o" />
            <span v-if="staffUnread" class="support-badge">{{ staffUnread > 99 ? '99+' : staffUnread }}</span>
          </div>
          <div class="grid-name">客服</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/level-requests')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#ff6a88,#ff99ac)">
            <van-icon name="medal-o" />
          </div>
          <div class="grid-name">等级审核</div>
        </div>
        <div class="grid-item" @click="onAutoTag">
          <div class="grid-ico" style="background: linear-gradient(135deg,#43e97b,#38f9d7)">
            <van-icon name="label-o" />
          </div>
          <div class="grid-name">自动打标</div>
        </div>
        <div class="grid-item" @click="onReconcile">
          <div class="grid-ico" style="background: linear-gradient(135deg,#ffecd2,#fcb69f)">
            <van-icon name="balance-list-o" />
          </div>
          <div class="grid-name">资金对账</div>
        </div>
      </div>
    </div>

    <!-- 数据总览 -->
    <div class="section">
      <div class="sec-title">运营数据</div>
      <div class="overview-grid">
        <div class="ov-item">
          <div class="ov-num">{{ overview.orderTotal || 0 }}</div>
          <div class="ov-label">订单总数</div>
        </div>
        <div class="ov-item">
          <div class="ov-num">¥{{ overview.gmv || '0.00' }}</div>
          <div class="ov-label">GMV<sup class="ov-tip">*</sup></div>
        </div>
        <div class="ov-item">
          <div class="ov-num">{{ overview.users || 0 }}</div>
          <div class="ov-label">用户总数</div>
        </div>
        <div class="ov-item">
          <div class="ov-num">{{ overview.agents || 0 }}</div>
          <div class="ov-label">代理总数</div>
        </div>
        <div class="ov-item">
          <div class="ov-num primary">¥{{ overview.platformCommission || '0.00' }}</div>
          <div class="ov-label">平台佣金<sup class="ov-tip">*</sup></div>
        </div>
      </div>
      <div class="ov-footnote">* GMV 和平台佣金为有效订单估值，以实际结算为准</div>
    </div>

    <!-- 今日概览 -->
    <div class="section">
      <div class="sec-title">今日概览</div>
      <div class="overview-grid">
        <div class="ov-item">
          <div class="ov-num">{{ overview.todayOrders || 0 }}</div>
          <div class="ov-label">今日订单</div>
        </div>
        <div class="ov-item">
          <div class="ov-num">¥{{ overview.todayCommission || '0.00' }}</div>
          <div class="ov-label">今日返利</div>
        </div>
        <div class="ov-item">
          <div class="ov-num">{{ overview.pendingWithdraw || 0 }}</div>
          <div class="ov-label">待审核提现</div>
        </div>
        <div class="ov-item">
          <div class="ov-num">{{ stats.pending || 0 }}</div>
          <div class="ov-label">待上架商品</div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="section">
      <div class="sec-title">快捷操作</div>
      <div class="quick-list">
        <div class="quick-item" @click="$router.push('/madmin/pool?status=3')">
          <div class="q-left">
            <van-icon name="clock-o" color="#ff9800" />
            <span>待上架商品</span>
          </div>
          <van-icon name="arrow" />
        </div>
        <div class="quick-item" @click="$router.push('/madmin/pool?status=1')">
          <div class="q-left">
            <van-icon name="success" color="#4caf50" />
            <span>已上架商品</span>
          </div>
          <van-icon name="arrow" />
        </div>
        <div class="quick-item" @click="onDedup">
          <div class="q-left">
            <van-icon name="orders-o" color="#2196f3" />
            <span>商品去重</span>
          </div>
          <van-icon name="arrow" />
        </div>
        <div class="quick-item" @click="onCleanOff">
          <div class="q-left">
            <van-icon name="delete-o" color="#f44336" />
            <span>清理下架商品</span>
          </div>
          <van-icon name="arrow" />
        </div>
      </div>
    </div>

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
      <van-tabbar-item to="/madmin/withdraws" icon="gold-coin-o">提现</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast, showSuccessToast } from 'vant';
import { io } from 'socket.io-client';
import { adminApi } from '../../api';

const router = useRouter();
const active = ref(0);

// 客服未读角标（用户消息即使已自动回复也计入）
const staffUnread = ref(0);
let supportSocket = null;
async function refreshStaffUnread() {
  try {
    const r = await adminApi.supportUnreadTotal();
    staffUnread.value = r.total || 0;
  } catch { /* ignore */ }
}
const stats = reactive({ onShelf: 0, pending: 0, offShelf: 0 });
const overview = reactive({
  orderTotal: 0,
  gmv: '0.00',
  users: 0,
  agents: 0,
  platformCommission: '0.00',
  todayOrders: 0,
  todayCommission: '0.00',
  pendingWithdraw: 0,
});

async function loadOverview() {
  try {
    // 并发加载：订单、用户、代理、待审核提现
    const [orders, users, agents, withdraws] = await Promise.all([
      adminApi.orders({ pageSize: 50, status: 'paid' }),
      adminApi.users({ pageSize: 1 }),
      adminApi.agents({ pageSize: 1 }),
      adminApi.withdraws({ status: 1, pageSize: 1 }),
    ]).catch(() => [null, null, null, null]);

    overview.orderTotal = orders?.total || 0;
    overview.users = users?.total || 0;
    overview.agents = agents?.total || 0;
    overview.pendingWithdraw = withdraws?.total || 0;

    // GMV 和平台佣金：从本页有效订单估算
    if (orders?.list?.length) {
      const validOrders = orders.list.filter((o) => {
        const s = o.status || o.orderStatus;
        // 已付款/已收货/已结算/已返利的都算有效
        return s === 'paid' || s === 'settled' || s === 1 || s === 2 || s === 3 || s === 5;
      });
      const gmv = validOrders.reduce((sum, o) => sum + Number(o.payAmount || o.price || 0), 0);
      const commission = validOrders.reduce(
        (sum, o) => sum + Number(o.estCommission || o.settleCommission || o.commission || 0), 0,
      );
      overview.gmv = gmv.toFixed(2);
      overview.platformCommission = commission.toFixed(2);

      // 今日订单和今日返利
      const today = new Date().toDateString();
      const todayOrders = orders.list.filter(
        (o) => new Date(o.createdAt || o.orderTime).toDateString() === today,
      );
      overview.todayOrders = todayOrders.length;
      const todayComm = todayOrders.reduce(
        (sum, o) => sum + Number(o.commission || o.estCommission || 0), 0,
      );
      overview.todayCommission = todayComm.toFixed(2);
    }
  } catch {
    // 加载失败不影响页面
  }
}

async function loadStats() {
  try {
    // 分别拉三个状态的总数
    const [r1, r3, r0] = await Promise.all([
      adminApi.curationList({ status: 1, pageSize: 1 }),
      adminApi.curationList({ status: 3, pageSize: 1 }),
      adminApi.curationList({ status: 0, pageSize: 1 }),
    ]);
    stats.onShelf = r1.total || 0;
    stats.pending = r3.total || 0;
    stats.offShelf = r0.total || 0;
  } catch {
    // 失败就显示 0
  }
}

async function onAutoTag() {
  try {
    await showConfirmDialog({
      title: '自动打标签',
      message: '将根据所有标签的关键词规则，给选品池里没有标签的上架商品自动打标。只追加新标签，不会覆盖已有标签。商品越多越慢，耐心等一下。',
      confirmButtonText: '开始打标',
      confirmButtonColor: '#07c160',
    });
    showToast('打标中，请稍候...');
    const r = await adminApi.curationAutoTagAll();
    showSuccessToast(
      `完成：${r.total || r.totalGoods || 0} 件商品，新增 ${r.tagged || r.newTags || 0} 个标签关联`,
    );
    loadStats();
  } catch (e) {
    if (e === 'cancel') return;
    showToast(e.message || '打标失败');
  }
}

async function onReconcile() {
  try {
    const r = await adminApi.reconcile();
    let msg = '对账正常';
    if (r && Object.keys(r).length) {
      msg = Object.entries(r)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    }
    showToast(msg);
  } catch (e) {
    showToast(e.message || '对账失败');
  }
}

async function onDedup() {
  try {
    await showConfirmDialog({
      title: '商品去重',
      message: '将按平台+商品ID 去重，保留最新的一条。确认继续？',
    });
    await adminApi.curationDedup();
    showToast('去重完成');
    loadStats();
  } catch (e) {
    if (e !== 'cancel') showToast(e.message || '操作失败');
  }
}

async function onCleanOff() {
  try {
    await showConfirmDialog({
      title: '清理下架商品',
      message: '将删除所有已下架的商品（包括人工下架和自动下架）。确认继续？',
    });
    await adminApi.curationRemoveOffShelf();
    showToast('清理完成');
    loadStats();
  } catch (e) {
    if (e !== 'cancel') showToast(e.message || '操作失败');
  }
}

async function onLogout() {
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确定要退出管理后台吗？',
    });
    localStorage.removeItem('adminToken');
    router.replace('/madmin/login');
  } catch {
    // cancel
  }
}

onMounted(() => {
  loadStats();
  loadOverview();
  refreshStaffUnread();
  // 管理首页保持 socket 连接：新客服消息/已读变化实时更新角标
  supportSocket = io({
    auth: { token: localStorage.getItem('adminToken') },
    transports: ['websocket', 'polling'],
  });
  supportSocket.on('support:message', refreshStaffUnread);
  supportSocket.on('support:conversation', refreshStaffUnread);
});

onUnmounted(() => {
  supportSocket?.disconnect();
  supportSocket = null;
});
</script>

<style scoped>
.madmin-home {
  padding-bottom: 60px;
  min-height: 100vh;
  background: #f5f6f8;
}
.header {
  background: linear-gradient(135deg, #ff4b3a 0%, #ff6b35 100%);
  padding: 44px 16px 48px;
  color: #fff;
  border-radius: 0 0 20px 20px;
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.title {
  font-size: 20px;
  font-weight: 600;
}
.logout {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.stats {
  display: flex;
  justify-content: space-around;
}
.stat-item {
  text-align: center;
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  opacity: 0.85;
  margin-top: 4px;
}
.section {
  margin: 12px;
  background: #fff;
  border-radius: 14px;
  padding: 16px;
}
.sec-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1a1a1a;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.grid-item:active { transform: scale(0.95); }
.grid-ico {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  position: relative;
}
/* 客服未读角标：压在图标右上角 */
.support-badge {
  position: absolute;
  top: -7px;
  right: -11px;
  min-width: 17px;
  height: 17px;
  line-height: 17px;
  padding: 0 4px;
  background: #f56c6c;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  border-radius: 9px;
  border: 2px solid #fff;
  box-sizing: content-box;
}
.grid-name {
  font-size: 12px;
  color: #666;
}
.quick-list {
  margin: 0 -8px;
}
.quick-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px;
  border-bottom: 1px solid #f5f5f5;
}
.quick-item:last-child { border-bottom: none; }
.quick-item:active { background: #f9f9f9; }
.q-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #333;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.ov-item {
  background: #fafafa;
  border-radius: 10px;
  padding: 14px 12px;
  text-align: center;
}
.ov-num {
  font-size: 20px;
  font-weight: 700;
  color: #ff4b3a;
  margin-bottom: 4px;
}
.ov-num.primary {
  color: #ff4b3a;
}
.ov-label {
  font-size: 12px;
  color: #999;
}
.ov-tip {
  font-size: 10px;
  color: #ccc;
  font-style: normal;
  margin-left: 2px;
}
.ov-footnote {
  margin-top: 8px;
  font-size: 11px;
  color: #bbb;
  text-align: center;
}
</style>
