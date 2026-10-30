/**
 * 环境配置
 *
 * - H5：用相对路径 /，走 manifest.json h5.devServer.proxy 或同源部署
 * - App / 微信小程序：必须用完整 https 域名（小程序后台要把该域名加入 request 合法域名）
 */
const PROD_BASE = 'https://fanly.lyelse.com';

// #ifdef H5
export const BASE_URL = '/';
// #endif

// #ifndef H5
export const BASE_URL = PROD_BASE;
// #endif

export default { BASE_URL, PROD_BASE };
