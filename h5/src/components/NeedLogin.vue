<template>
  <div class="need-login">
    <van-icon name="user-circle-o" size="56" color="#ffb3ab" />
    <div class="t">{{ title }}</div>
    <div class="s">{{ desc }}</div>
    <van-button
      round
      type="primary"
      color="#ff4b3a"
      style="margin-top:22px;width:180px"
      @click="$router.push({ path: '/login', query: { redirect: $route.fullPath } })"
    >
      立即登录
    </van-button>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '登录后查看' },
  desc: { type: String, default: '手机号一键登录，登录后才能记录你的返利' },
});
</script>
