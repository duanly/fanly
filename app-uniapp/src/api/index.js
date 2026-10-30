import { get, post, del, uploadFile } from '../utils/request.js';

/**
 * 用户端接口（1:1 对齐 H5 api/index.js 的 api 对象）
 * 底层已由 axios 换成 uni.request
 */
export const api = {
  // ── 认证 ──
  sendSms: (mobile) => post('/api/auth/sms', { mobile }),
  getCaptcha: () => get('/api/auth/captcha'),
  register: (data) => post('/api/auth/register', data),
  login: (data) => post('/api/auth/login', data),
  changePassword: (data) => post('/api/auth/password', data),
  profile: () => get('/api/auth/profile'),
  updateProfile: (data) => post('/api/auth/profile', data),
  uploadAvatar: (filePath) => uploadFile('/api/auth/avatar', filePath),
  bindInviter: (inviteCode) => post('/api/auth/bind-inviter', { inviteCode }),
  getRealName: () => get('/api/auth/realname'),
  submitRealName: (data) => post('/api/auth/realname', data),

  // ── 商品 / 首页 ──
  recommend: (platform) => get('/api/goods/recommend', { platform }),
  feed: (params) => get('/api/goods/feed', params),
  goodsGroups: () => get('/api/goods/groups'),
  topics: () => get('/api/topics'),
  topicGoods: (slug, params) => get(`/api/topics/${slug}/goods`, params),

  compareList: (params) => get('/api/compare/list', params),
  compareDetail: (id) => get(`/api/compare/${id}`),
  compareCategories: () => get('/api/compare/categories'),
  compareSearch: (keyword) => get('/api/compare/search', { keyword }),

  homeLinks: (slot) => get('/api/home/links', { slot }),
  ranking: (type, params) =>
    get('/api/home/ranking', typeof params === 'object' ? { type, ...params } : { type, limit: params }),

  // ── 购物车 / 搜索 / 详情 / 转链 ──
  cart: () => get('/api/cart'),
  cartCount: () => get('/api/cart/count'),
  cartRefresh: () => post('/api/cart/refresh'),
  cartAdd: (platform, goodsId) => post('/api/cart/add', { platform, goodsId }),
  cartRemove: (ids) => del('/api/cart', { ids }),
  search: (params) => get('/api/goods/search', params),
  detail: (platform, goodsId) => get(`/api/goods/${platform}/${goodsId}`),
  convert: (platform, goodsId) => post('/api/link/convert', { platform, goodsId }),
  parse: (content) => post('/api/link/parse', { content }),

  authzStatus: (platform, force) =>
    get('/api/authz/status', { platform, force: force ? 1 : undefined }),
  authzUrl: (platform) => get('/api/authz/url', { platform }),

  // ── 订单 / 找回 ──
  orders: (params) => get('/api/orders', params),
  claimApply: (data) => post('/api/claim', data),
  claimList: (params) => get('/api/claim', params),

  // ── 签到金币 ──
  recommendGoods: (platform, goodsId) =>
    post('/api/goods/recommend', { platform, goodsId }),
  coinStatus: () => get('/api/coin/status'),
  checkin: () => post('/api/coin/checkin'),
  coinExchange: (coins) => post('/api/coin/exchange', { coins }),
  coinLedger: (params) => get('/api/coin/ledger', params),

  // ── 资金提现 ──
  balance: () => get('/api/fund/balance'),
  summary: () => get('/api/fund/summary'),
  withdraws: (params) => get('/api/fund/withdraws', params),
  ledger: (params) => get('/api/fund/ledger', params),
  withdraw: (data) => post('/api/fund/withdraw', data),
  getPaymentMethod: () => get('/api/fund/payment-method'),
  savePaymentMethod: (data) => post('/api/fund/payment-method', data),

  // ── 代理 ──
  agentApply: (realName) => post('/api/agent/apply', { realName }),
  agentQrcode: () => get('/api/agent/qrcode'),
  agentInviteQrcode: () => get('/api/agent/invite-qrcode'),
  agentTeam: (params) => get('/api/agent/team', params),
  agentStats: () => get('/api/agent/stats'),
  agentInfo: (code) => get('/api/agent/info', { code }),

  // ── 本地生活（聚推客）──
  jtkActivities: (params) => get('/api/jtk/activities', params),
  jtkConvert: (actId) => post('/api/jtk/convert', { actId }),
  jtkEleActivities: (params) => get('/api/jtk/ele/activities', params),
  jtkEleConvert: (activityId) => post('/api/jtk/ele/convert', { activityId }),
  jtkMtCoupons: (params) => get('/api/jtk/mt/coupons', params),
  jtkMtCouponConvert: (actId) => post('/api/jtk/mt/coupon/convert', { actId }),

  // ── 客服 ──
  supportUnread: () => get('/api/support/unread'),
  supportConversation: () => get('/api/support/conversation'),
  sendSupportMessage: (type, content) => post('/api/support/messages', { type, content }),
  readSupport: () => post('/api/support/read'),
  supportUpload: (filePath) => uploadFile('/api/support/upload', filePath),
};

export default api;
