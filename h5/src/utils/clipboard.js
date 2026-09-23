/**
 * 剪贴板读取。浏览器对它限制很多：
 *  - 必须 HTTPS（或 localhost）
 *  - Safari 只在用户手势里给读，还会弹系统确认
 *  - 微信内置浏览器基本读不到
 * 所以一律当「尽力而为」，读不到就走手动粘贴，不能挡住流程。
 */
export async function readClipboard() {
  try {
    if (!navigator.clipboard?.readText) return null;
    const t = await navigator.clipboard.readText();
    return (t || '').trim() || null;
  } catch {
    return null;
  }
}

export async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 本地粗筛：这段文本看着像不像商品分享？
 * 只用来决定要不要弹提示，真正的识别在服务端。
 * 宁可漏判也别误判——弹错了很烦人。
 */
const HINTS = [
  /[¥￥€$][A-Za-z0-9]{8,20}[¥￥€$]/,
  /(m\.tb\.cn|item\.taobao\.com|detail\.tmall\.com)/i,
  /(u\.jd\.com|item\.jd\.com|3\.cn)/i,
  /(yangkeduo\.com|pinduoduo\.com)/i,
  /(v\.douyin\.com|jinritemai\.com)/i,
  /\bMK\d{8}\b/,
];

export function looksLikeShare(text) {
  if (!text || text.length < 6 || text.length > 2000) return false;
  return HINTS.some((re) => re.test(text));
}
