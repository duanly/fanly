<template>
  <div class="page">
    <!-- 搜索：既搜比价组，也搜全网商品 -->
    <div class="cmp-head">
      <div class="search-box" @click="focusSearch">
        <van-icon name="search" color="#ff4b3a" size="16" style="margin-right:6px" />
        <input
          ref="inputRef"
          v-model="keyword"
          placeholder="搜商品，有同款会一起比价"
          @keyup.enter="doSearch"
        />
        <span class="search-btn" @click.stop="doSearch">搜索</span>
      </div>
    </div>

    <!-- 品类导航 -->
    <div class="chip-row" style="padding:10px 12px 2px">
      <div
        v-for="c in cats"
        :key="c.key"
        class="chip"
        :class="{ active: cat === c.key }"
        @click="switchCat(c.key)"
      >
        {{ c.name }}<span v-if="c.total" class="n">{{ c.total }}</span>
      </div>
    </div>

    <div class="cmp-intro">
      比的是<b>到手价</b>（券后价 − 返利），不是券后价。
      各平台佣金不一样，经常券后便宜的那家反而更贵。
    </div>

    <van-loading v-if="loading" style="padding:50px;text-align:center" />

    <template v-else>
      <!-- 搜索命中的比价组 -->
      <div v-if="searched && groups.length" class="sec-title">
        找到 {{ groups.length }} 组可比价
      </div>

      <div
        v-for="g in groups"
        :key="g.id"
        class="cmp-card"
        @click="$router.push(`/compare/${g.id}`)"
      >
        <img :src="g.cover" loading="lazy" />
        <div class="body">
          <div class="n">{{ g.name }}</div>
          <div v-if="g.spec" class="muted sp">{{ g.spec }}</div>
          <div class="plats">
            <span v-for="p in g.platforms" :key="p" class="pt">{{ platformName(p) }}</span>
          </div>
          <div class="row">
            <div>
              <span class="muted" style="font-size:11px">最低到手</span>
              <span class="price" style="font-size:18px">¥{{ g.best?.finalPrice }}</span>
              <span class="muted" style="font-size:11px">· {{ platformName(g.best?.platform) }}</span>
            </div>
            <span v-if="g.maxSave > 0" class="save">比最贵省 ¥{{ g.maxSave }}</span>
          </div>
        </div>
      </div>

      <!-- 搜索时额外给全网商品，没有同款也别让用户空手 -->
      <template v-if="searched">
        <div v-if="goods.length" class="sec-title">
          全网商品 <span class="muted" style="font-weight:400">· 按到手返利排</span>
        </div>
        <div class="goods-grid">
          <GoodsCard v-for="g in goods" :key="g.platform + g.goodsId" :g="g" />
        </div>
      </template>

      <van-empty
        v-if="!groups.length && !goods.length"
        :description="searched ? '没搜到，换个词试试' : '这个品类还没有比价商品'"
      >
        <div v-if="!searched" class="muted" style="font-size:12px;padding:0 30px;line-height:1.6">
          去后台「比价组」建一组，把同款商品从各平台挑进去
        </div>
      </van-empty>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { CATEGORIES, categoryName } from '../constants/groups';

const platformName = (p) => ({ PDD: '拼多多', JD: '京东', TB: '淘宝', DY: '抖音' }[p] || p || '');

const keyword = ref('');
const inputRef = ref(null);
const cat = ref('');
const cats = ref([{ key: '', name: '全部' }]);
const groups = ref([]);
const goods = ref([]);
const loading = ref(true);
const searched = ref(false);

const focusSearch = () => inputRef.value?.focus();

async function loadCats() {
  try {
    const rows = await api.compareCategories();
    const stat = Object.fromEntries(rows.map((r) => [r.key, r.total]));
    // 只列真有比价组的品类，空品类点进去是死路
    const used = CATEGORIES.filter((c) => stat[c.key]);
    cats.value = [
      { key: '', name: '全部' },
      ...used.map((c) => ({ ...c, total: stat[c.key] })),
    ];
  } catch {
    cats.value = [{ key: '', name: '全部' }];
  }
}

async function loadList() {
  loading.value = true;
  searched.value = false;
  goods.value = [];
  try {
    groups.value = await api.compareList({ group: cat.value || undefined, limit: 30 });
  } catch {
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function switchCat(k) {
  cat.value = k;
  keyword.value = '';
  loadList();
}

async function doSearch() {
  const k = keyword.value.trim();
  if (!k) return loadList();

  loading.value = true;
  searched.value = true;
  try {
    // 两件事并行：比价组命中 + 全网商品，慢的那个不拖快的
    const [g, s] = await Promise.all([
      api.compareSearch(k).catch(() => []),
      api.search({ platform: 'ALL', keyword: k, pageSize: 20 }).catch(() => ({ list: [] })),
    ]);
    groups.value = g || [];
    goods.value = s.list || [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadCats();
  loadList();
});
</script>

<style scoped>
.cmp-head { background: #fff; padding: 10px 12px; }
.cmp-intro {
  margin: 10px 12px 0;
  padding: 10px 12px;
  background: #fff7f5;
  border-radius: 8px;
  color: #a8613f;
  font-size: 12px;
  line-height: 1.6;
}
.cmp-intro b { color: #ff4b3a; }

.chip .n {
  margin-left: 4px;
  opacity: .6;
  font-size: 11px;
  font-weight: 400;
}

.sec-title {
  padding: 16px 14px 4px;
  font-size: 15px;
  font-weight: 700;
}

.cmp-card {
  display: flex;
  gap: 10px;
  background: #fff;
  margin: 10px 12px;
  border-radius: 12px;
  padding: 12px;
}
.cmp-card img {
  width: 86px; height: 86px; flex: none;
  border-radius: 8px; object-fit: cover; background: #eee;
}
.cmp-card .body { flex: 1; min-width: 0; }
.cmp-card .n { font-size: 14px; font-weight: 600; line-height: 1.4; }
.cmp-card .sp { font-size: 11px; margin-top: 2px; }
.plats { display: flex; gap: 5px; margin: 6px 0; flex-wrap: wrap; }
.pt {
  font-size: 10px; color: #969799;
  border: 1px solid #ebedf0; border-radius: 4px;
  padding: 1px 5px;
}
.cmp-card .row {
  display: flex; align-items: baseline;
  justify-content: space-between; margin-top: 4px;
}
.save {
  font-size: 11px; color: #fff; background: #ff4b3a;
  border-radius: 999px; padding: 2px 8px; white-space: nowrap;
}
</style>
