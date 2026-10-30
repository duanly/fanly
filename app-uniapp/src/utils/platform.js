/**
 * 平台标识（移植自 H5 utils/platform.js）
 */
const PLATFORMS = [
  { key: 'TB', name: '淘宝', short: '淘', bg: '#ff5000' },
  { key: 'JD', name: '京东', short: '京', bg: '#c81623' },
  { key: 'VIP', name: '唯品会', short: '唯', bg: '#ff2d52' },
  { key: 'PDD', name: '拼多多', short: '多', bg: '#e02e24' },
  { key: 'JTK', name: '本地生活', short: '生', bg: '#ff9500' },
];

const PLAT = Object.fromEntries(PLATFORMS.map((p) => [p.key, p]));

export const platName = (key) => PLAT[key]?.name || key || '';
export const platShort = (key) => PLAT[key]?.short || (key || '').slice(0, 1);
export const platColor = (key) => PLAT[key]?.bg || '#969799';
