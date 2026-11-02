<template>
  <div class="beian">
    <a v-if="ICP" :href="MIIT" target="_blank" rel="noreferrer">{{ ICP }}</a>
    <div class="who">{{ OWNER }}</div>
  </div>
</template>

<script setup>
/**
 * 备案号展示。
 *
 * 不是装饰——《互联网信息服务管理办法》要求已备案网站在首页底部
 * 标注备案号并链接到工信部查询系统。漏了会在巡检时被通知整改。
 *
 * ⚠️ 2026-10-31：主体变更为「耒阳市优辰网络科技有限公司」，原备案号
 * 随旧主体停用、新备案号尚未下发，暂时不渲染。新号下来后只改 ICP 这一行。
 */
const ICP = ''; // ← 新备案号填这里，例如 '湘ICP备XXXXXXXX号'
const OWNER = '耒阳市优辰网络科技有限公司';
const MIIT = 'https://beian.miit.gov.cn';
</script>

<style scoped>
.beian {
  padding: 22px 16px 16px;
  text-align: center;
  color: #c0c2c6;
  font-size: 11px;
  line-height: 1.8;
}
.beian a { color: #969799; text-decoration: none; }
.who { font-size: 10px; }
</style>
