/**
 * 分享内容识别：从用户粘贴的一坨东西里认出「哪个平台 + 哪个商品」。
 *
 * 用户粘过来的从来不是干净的 URL，而是类似：
 *   「6.0 复制打开淘宝，【纯棉短袖T恤】¥Ab3XdYeFgHi¥ 或长按复制此条信息」
 *   「https://u.jd.com/abcdef 点击链接直接打开」
 *   「【拼多多】我在拼多多发现个好东西 https://mobile.yangkeduo.com/goods.html?goods_id=123」
 *
 * 所以先本地把平台和关键 token 抠出来，再只调对应平台的接口，
 * 比挨个平台瞎试快得多，报错也说得清。
 */

export type SharePlatform = 'TB' | 'JD' | 'PDD' | 'DY';

/** token 的形态：口令 / 链接 / 纯商品 ID */
export type TokenKind = 'password' | 'url' | 'goodsId';

export interface ShareParseResult {
  platform: SharePlatform;
  /** 交给渠道接口的关键串 */
  token: string;
  kind: TokenKind;
  /** 顺手抠出来的商品标题，用于解析失败时给用户看 */
  title?: string;
}

const PLATFORM_NAME: Record<SharePlatform, string> = {
  TB: '淘宝/天猫',
  JD: '京东',
  PDD: '拼多多',
  DY: '抖音',
};

export function platformName(p: string): string {
  return PLATFORM_NAME[p as SharePlatform] || p;
}

/** 域名 → 平台。注意顺序：短链域名要先于通用域名匹配 */
const URL_RULES: { re: RegExp; platform: SharePlatform }[] = [
  // 淘宝天猫
  { re: /(?:m\.tb\.cn|tb\.cn|e\.tb\.cn)\/\S+/i, platform: 'TB' },
  { re: /(?:item\.taobao\.com|detail\.tmall\.com|item\.tmall\.com|main\.m\.taobao\.com|a\.m\.taobao\.com)\/\S+/i, platform: 'TB' },
  // 京东
  { re: /(?:u\.jd\.com|3\.cn|jd\.com\/t\/|u\.jr\.jd\.com)\/\S+/i, platform: 'JD' },
  { re: /(?:item\.jd\.com|item\.m\.jd\.com|jd\.com\/product)\/\S+/i, platform: 'JD' },
  // 拼多多
  { re: /(?:mobile\.yangkeduo\.com|yangkeduo\.com|pinduoduo\.com|p\.pinduoduo\.com)\/\S+/i, platform: 'PDD' },
  // 抖音
  { re: /(?:v\.douyin\.com|haohuo\.jinritemai\.com|jinritemai\.com|douyin\.com)\/\S+/i, platform: 'DY' },
];

/** 口令格式 */
const PASSWORD_RULES: { re: RegExp; platform: SharePlatform }[] = [
  // 淘口令：¥xxx¥ 或 €xxx€ 或 （xxx） ，11~14 位字母数字
  { re: /[¥￥€$]([A-Za-z0-9]{8,20})[¥￥€$]/, platform: 'TB' },
  // 京东口令：形如 (￥xxx￥) 或 JD 的 数字字母混合口令块
  { re: /[（(]([A-Za-z0-9]{10,20})[)）]/, platform: 'JD' },
];

/** 从 URL 里抠商品 ID，能抠到就用 ID，比整条链接稳 */
const GOODS_ID_RULES: { re: RegExp; platform: SharePlatform }[] = [
  { re: /item\.taobao\.com\/item\.htm[^\s]*?[?&]id=(\d+)/i, platform: 'TB' },
  { re: /detail\.tmall\.com\/item\.htm[^\s]*?[?&]id=(\d+)/i, platform: 'TB' },
  { re: /item\.jd\.com\/(\d+)\.html/i, platform: 'JD' },
  { re: /item\.m\.jd\.com\/product\/(\d+)/i, platform: 'JD' },
  { re: /yangkeduo\.com\/goods\.html[^\s]*?[?&]goods_id=(\d+)/i, platform: 'PDD' },
];

/** 我们自己 Mock 渠道的商品号，方便本地联调 */
const MOCK_RULE = /\b(MK\d{8})\b/;

/** 抠出【】或方括号里的商品标题，解析失败时拿来提示用户 */
function extractTitle(text: string): string | undefined {
  const m = /[【\[]([^】\]]{2,40})[】\]]/.exec(text);
  return m ? m[1].trim() : undefined;
}

/**
 * 识别分享内容。认不出来返回 null，让调用方给出「没认出来」的提示，
 * 而不是傻乎乎地把整段文字丢给四个平台挨个试。
 */
export function parseShareContent(raw: string): ShareParseResult | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const title = extractTitle(text);

  // 1. Mock 商品号（本地联调用）
  const mock = MOCK_RULE.exec(text);
  if (mock) return { platform: 'PDD', token: mock[1], kind: 'goodsId', title };

  // 2. 商品 ID 最精确，优先
  for (const r of GOODS_ID_RULES) {
    const m = r.re.exec(text);
    if (m) return { platform: r.platform, token: m[1], kind: 'goodsId', title };
  }

  // 3. 短链之类没有明文 ID 的，整条 URL 交给渠道去还原
  for (const r of URL_RULES) {
    const m = r.re.exec(text);
    if (m) {
      const url = m[0].replace(/[，。、）)]+$/, '');
      return { platform: r.platform, token: url, kind: 'url', title };
    }
  }

  // 4. 口令
  for (const r of PASSWORD_RULES) {
    const m = r.re.exec(text);
    if (m) return { platform: r.platform, token: m[0], kind: 'password', title };
  }

  // 5. 文案里点名了平台但没给链接——能提示得更准一点
  if (/淘宝|天猫/.test(text)) return null;
  return null;
}

/** 认不出来时，根据内容猜个原因给用户看 */
export function explainParseFailure(raw: string): string {
  const text = (raw || '').trim();
  if (!text) return '先复制商品链接或口令，再回来点一下';
  if (text.length > 500) return '内容太长了，只复制商品链接那一段试试';
  if (/^https?:\/\//i.test(text)) return '这个链接不是淘宝/京东/拼多多/抖音的商品页';
  if (!/[a-zA-Z0-9]/.test(text)) return '没找到商品链接或口令，复制完整的分享内容再试';
  return '没认出这个商品，确认复制的是商品分享内容，不是店铺或活动页';
}
