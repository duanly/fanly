/**
 * 平台标识的唯一来源。
 *
 * 之前 GoodsCard / Cart / Detail / Home 各抄了一份，改个颜色要改四处，
 * 还出现过 PDD 在这里叫「拼」在那里叫「拼多多」的情况。统一到这儿。
 *
 * short 用一个字：角标空间就那么大，一个字比两三个字清楚得多，
 * 也不会跟商品标题抢视线。拼多多取「多」不取「拼」，是跟着它自己
 * 「多多」的叫法走，用户认这个字。
 *
 * 注意 PDD 和 JD 的品牌色都是红的，肉眼分不开——区分靠的是那个字，
 * 颜色只是让角标贴合平台观感，别指望用户靠颜色认平台。
 */
export const PLATFORMS = [
  { key: 'PDD', name: '拼多多', short: '多', bg: '#e02e24' },
  { key: 'JD', name: '京东', short: '京', bg: '#c81623' },
  { key: 'TB', name: '淘宝', short: '淘', bg: '#ff5000' },
  { key: 'DY', name: '抖音', short: '抖', bg: '#161823' },
];

/** 按 key 取，方便模板里 PLAT[g.platform]?.short 这种写法 */
export const PLAT = Object.fromEntries(PLATFORMS.map((p) => [p.key, p]));

/** 拿不到配置时别显示空白，退回平台代码 */
export const platName = (key) => PLAT[key]?.name || key || '';
export const platShort = (key) => PLAT[key]?.short || (key || '').slice(0, 1);
export const platColor = (key) => PLAT[key]?.bg || '#969799';
