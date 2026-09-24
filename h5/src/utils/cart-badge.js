import { ref } from 'vue';

/**
 * 购物车角标。
 *
 * 详情页加购、购物车页删除，都要让底部那个数字立刻变。
 * 为这点事上 Pinia 不值当，一个模块级 ref 就够——
 * 整个应用只有一个购物车，不存在多实例。
 */
export const cartCount = ref(0);

export function setCartCount(n) {
  cartCount.value = Math.max(0, Number(n) || 0);
}

export function bumpCartCount(delta = 1) {
  setCartCount(cartCount.value + delta);
}
