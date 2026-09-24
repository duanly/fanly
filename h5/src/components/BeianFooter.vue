<template>
  <div class="beian">
    <a :href="MIIT" target="_blank" rel="noreferrer">{{ ICP }}</a>
    <div class="who">{{ OWNER }}</div>
  </div>
</template>

<script setup>
/**
 * 备案号展示。
 *
 * 不是装饰——《互联网信息服务管理办法》要求已备案网站在首页底部
 * 标注备案号并链接到工信部查询系统。漏了会在巡检时被通知整改。
 */
const ICP = '赣ICP备2025075810号-7';
const OWNER = '上海跃蛙智能科技有限公司';
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
