/**
 * 图片地址补全：服务端上传接口返回的是站内相对路径（/uploads/xxx.png），
 * H5 同源部署能直接用，但 App / 小程序的 <image> 没有 host，必须补完整域名。
 *
 * 规则：
 * - http(s)://、协议相对 //、data:、blob: → 原样（// 补 https:）
 * - /static/、/uni_modules/ 开头 → 安装包内资源，原样返回，切勿补域名
 * - 其他 / 开头的站内路径 → 非 H5 端补 PROD_BASE，H5 保持相对路径
 * - 本地临时路径（uni.chooseImage 的 _doc/、wxfile://、http://tmp/...）→ 原样
 */
import config from '../config.js';

const LOCAL_PKG = /^\/(static|uni_modules)\//;

export function resolveImg(src) {
  const v = (src || '').trim();
  if (!v) return '';
  if (/^https?:\/\//.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  if (/^(data:|blob:)/.test(v)) return v;
  if (LOCAL_PKG.test(v)) return v;
  if (v.startsWith('/')) return config.BASE_URL === '/' ? v : config.PROD_BASE + v;
  return v;
}
