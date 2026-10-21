import { Logger } from '@nestjs/common';
import {
  ConvertedLink, CpsProvider, GoodsPage, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

const DEFAULT_BASE = 'https://api.tbk.dingdanxia.com';
const FETCH_TIMEOUT_MS = 30000;

export interface DingdanxiaPddOptions {
  /** 订单侠 API Key */
  apiKey: string;
  /** 拼多多推广位 PID（多多进宝的 p_id，形如 8735184_70977074） */
  pid?: string;
  /** 自定义 baseUrl，有专线域名时填这个 */
  baseUrl?: string;
}

/** 分 -> 元 */
const yuan = (v: any) => Math.round(Number(v ?? 0)) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** "1.2万" / "1000+" / 1234 都要能变成数字 */
function parseSales(v: any): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v);
  const n = parseFloat(s.replace(/[^\d.]/g, '')) || 0;
  if (s.includes('亿')) return Math.round(n * 1e8);
  if (s.includes('万')) return Math.round(n * 1e4);
  return Math.round(n);
}

/**
 * 订单侠拼多多聚合渠道。
 *
 * 接口路径前缀：/pdd/
 *   - 搜索：/pdd/goods_search
 *   - 推荐：/pdd/recommend
 *   - 转链：/pdd/convert
 *   - 详情：搜索/推荐结果中已有完整字段，详情复用搜索（按 goods_sign 搜）
 *   - 订单：/pdd/order_list（TODO：待确认路径与字段）
 *   - 解析：从文本抠 goods_sign / goods_id，再走详情
 */
export class DingdanxiaPddProvider implements CpsProvider {
  readonly platform = 'PDD';
  private readonly logger = new Logger(DingdanxiaPddProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly opt: DingdanxiaPddOptions) {
    this.baseUrl = opt.baseUrl || DEFAULT_BASE;
  }

  private async call<T>(path: string, body: Record<string, any>): Promise<T> {
    const json = await this.callRaw(path, body);
    return (json.data ?? json.result ?? json) as T;
  }

  private async callRaw(path: string, body: Record<string, any>): Promise<any> {
    if (!this.opt.apiKey) {
      throw new Error('订单侠未配置：请在 .env 填 DDX_API_KEY');
    }
    const url = new URL(path, this.baseUrl);
    const payload = { ...body, apikey: this.opt.apiKey };
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined || payload[k] === null || payload[k] === '') {
        delete payload[k];
      }
    }
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload).toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (e: any) {
      this.logger.error(`拼多多请求失败: ${url.toString()}, error: ${e.message}`);
      throw e;
    }
    if (!res.ok) throw new Error(`订单侠拼多多 ${path} HTTP ${res.status}`);
    const json: any = await res.json();
    if (json.code !== undefined && json.code !== 200 && json.code !== 0) {
      throw new Error(`订单侠拼多多 ${path}: ${json.code} ${json.msg || json.message || ''}`);
    }
    return json;
  }

  // ───────────────────────── 字段映射 ─────────────────────────

  private mapGoods(r: any): UnifiedGoods {
    const price = yuan(r.min_group_price ?? r.min_normal_price);

    // 券有门槛：满 coupon_min_order_amount 才能用
    const quota = yuan(r.coupon_min_order_amount ?? 0);
    const usable = r.has_coupon && (quota <= 0 || price >= quota);
    const coupon = usable ? yuan(r.coupon_discount) : 0;

    const couponPrice = round2(Math.max(price - coupon, 0));
    const rate = Number(r.promotion_rate ?? 0) / 1000; // 千分比
    const commission = round2(couponPrice * rate);

    // 轮播图
    let images: string[] = [];
    const gallery = r.goods_gallery_urls ?? r.images ?? [];
    if (Array.isArray(gallery)) {
      images = gallery.filter(Boolean);
    }

    return {
      platform: 'PDD',
      goodsId: String(r.goods_sign ?? r.goods_id ?? ''),
      title: r.goods_name ?? r.title ?? '',
      image: r.goods_thumbnail_url || r.goods_image_url || '',
      images,
      shopName: r.mall_name || r.mall_name_v2 || '',
      price,
      couponPrice,
      couponAmount: coupon,
      commissionRate: rate,
      commission,
      salesVolume: parseSales(r.sales_tip ?? r.sale_num24 ?? r.sale_num_today),
    };
  }

  // ───────────────────────── CpsProvider ─────────────────────────

  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    return (await this.searchGoodsPage(p)).list;
  }

  async searchGoodsPage(p: SearchParams): Promise<GoodsPage> {
    const sortMap: Record<string, number> = {
      sales: 6,        // 按销量降序
      commission: 14,  // 按佣金金额降序
      price: 10,       // 按券后价降序
    };
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(Math.max(p.pageSize ?? 20, 10), 100);

    const data = await this.call<any>('/pdd/goods_search', {
      keyword: p.keyword,
      page,
      page_size: pageSize,
      sort_type: sortMap[p.sort ?? ''] ?? 0,
      pid: this.opt.pid,
      with_coupon: true,
    });

    // 订单侠拼多多搜索返回的商品列表可能在 data.list / data.goods_list / 直接就是数组
    const rawList = data?.list ?? data?.goods_list ?? (Array.isArray(data) ? data : []);
    const list = rawList.map((r: any) => this.mapGoods(r));
    const total = Number(data?.total_results ?? data?.total ?? list.length);
    return { list, total, page, hasMore: page * pageSize < total };
  }

  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    return (await this.recommendGoodsPage(p)).list;
  }

  async recommendGoodsPage(p: RecommendParams = {}): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const limit = Math.min(p.pageSize ?? 20, 50);
    const offset = (page - 1) * limit;

    // channel_type 映射：earn=高佣(6), hot=热销(5), cheap=低价(0), pick=猜你喜欢(4)
    const channelMap: Record<string, number> = {
      earn: 6,   // 实时收益榜 → 高佣
      hot: 5,    // 实时热销榜
      cheap: 0,  // 低价
      pick: 4,   // 猜你喜欢
    };
    const channelType = channelMap[p.channel ?? 'earn'] ?? 5;

    const data = await this.call<any>('/pdd/recommend', {
      offset,
      limit,
      channel_type: channelType,
      pid: this.opt.pid,
    });

    const rawList = data?.list ?? data?.goods_list ?? (Array.isArray(data) ? data : []);
    const list = rawList.map((r: any) => this.mapGoods(r));
    const total = Number(data?.total ?? 0);
    const hasMore = total ? offset + list.length < total : list.length === limit;
    return { list, total, page, hasMore };
  }

  async getGoodsDetail(goodsSign: string): Promise<UnifiedGoods | null> {
    if (!goodsSign) return null;
    // 订单侠拼多多没有单独的详情接口，用 goods_sign 当关键词搜，取第一条匹配
    try {
      const data = await this.call<any>('/pdd/goods_search', {
        goods_sign_list: [goodsSign],
        page: 1,
        page_size: 10,
        pid: this.opt.pid,
      });
      const rawList = data?.list ?? data?.goods_list ?? (Array.isArray(data) ? data : []);
      const hit = rawList.find((g: any) =>
        String(g.goods_sign ?? g.goods_id ?? '') === goodsSign,
      ) ?? rawList[0];
      return hit ? this.mapGoods(hit) : null;
    } catch (e: any) {
      this.logger.warn(`拼多多详情查询失败 goods_sign=${goodsSign}: ${e.message}`);
      return null;
    }
  }

  async convertLink(goodsSign: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.pid) throw new Error('拼多多未配置推广位：请在 .env 填 PDD_PID');

    // custom_parameters 有 64 字节硬上限
    const custom = JSON.stringify({ uid: positionId });
    if (Buffer.byteLength(custom, 'utf8') > 64) {
      throw new Error(`custom_parameters 超长(${Buffer.byteLength(custom)}B)，positionId 需要缩短`);
    }

    const data = await this.call<any>('/pdd/convert', {
      p_id: this.opt.pid,
      goods_sign: goodsSign,
      custom_parameters: custom,
      generate_short_url: true,
      generate_schema_url: true,
      multi_group: true,
      generate_we_app: true,
      itemInfo: false,
    });

    if (!data) throw new Error('拼多多转链返回为空');

    // 订单侠转链返回字段：short_url, url, mobile_short_url, mobile_url, schema_url, we_app_info
    return {
      platform: 'PDD',
      goodsId: goodsSign,
      shortUrl: data.mobile_short_url || data.short_url || data.url || data.mobile_url || '',
      deeplink: data.schema_url || data.mobile_url || '',
      password: '', // 拼多多没有淘口令
      positionId,
    };
  }

  /**
   * 分享内容解析：从文本里抠 goods_sign 或 goods_id，再走详情。
   * 短链靠 302 跳转还原。
   */
  async parseContent(text: string): Promise<UnifiedGoods | null> {
    const sign = await this.resolveGoodsSign(text);
    if (!sign) return null;
    return this.getGoodsDetail(sign);
  }

  /**
   * 拉取订单。
   *
   * TODO：订单侠拼多多订单接口路径和字段待确认。
   * 猜测路径：/pdd/order_list 或 /pdd/order_details
   * 暂时走直连 provider 的兜底，等联调时再补。
   */
  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    // 先按常见的订单侠命名试一下，如果失败返回空数组，上层会记录错误
    try {
      const data = await this.call<any>('/pdd/order_list', {
        start_time: Math.floor(start.getTime() / 1000),
        end_time: Math.floor(end.getTime() / 1000),
        page,
        page_size: 100,
      });
      const rawList = data?.list ?? data?.order_list ?? (Array.isArray(data) ? data : []);
      return rawList.map((r: any) => this.mapOrder(r));
    } catch (e: any) {
      this.logger.warn(`拼多多订单接口暂不可用: ${e.message}`);
      return [];
    }
  }

  /**
   * 拼多多订单状态映射：
   *   -1 已取消 / 0 已支付 / 1 已成团 / 2 确认收货 / 3 审核成功
   *   / 4 审核失败 / 5 已结算 / 8 非多多进宝商品 / 10 已处罚
   * 归一到：1 已付款 / 2 已收货 / 3 已结算 / 4 已失效
   */
  private mapOrder(r: any): UnifiedOrder {
    const st = Number(r.order_status ?? r.status ?? 0);
    const status = st === 5 ? 3          // 已结算
      : st === 2 || st === 3 ? 2        // 确认收货 / 审核成功 → 已收货
      : st === 0 || st === 1 ? 1        // 已支付 / 已成团 → 已付款
      : 4;                               // 其他 → 已失效

    // custom_parameters 是转链时塞进去的，订单归属全靠它
    let positionId = '';
    const cp = r.custom_parameters;
    if (cp) {
      try { positionId = JSON.parse(cp).uid ?? ''; } catch { positionId = String(cp); }
    }

    const est = yuan(r.promotion_amount ?? r.commission ?? 0);
    const ts = (v: any) => {
      if (!v) return undefined;
      const n = Number(v);
      return n > 1e12 ? new Date(n) : new Date(n * 1000);
    };

    return {
      platform: 'PDD',
      platformOrderNo: String(r.order_sn ?? r.order_id ?? r.id ?? ''),
      subOrderNo: String(r.order_sn ?? r.order_id ?? ''),
      positionId,
      goodsId: String(r.goods_id ?? r.goods_sign ?? ''),
      goodsTitle: r.goods_name ?? r.goods_title ?? '',
      goodsImg: r.goods_thumbnail_url ?? r.goods_image ?? '',
      payAmount: yuan(r.order_amount ?? r.pay_amount ?? 0),
      commissionRate: Number(r.promotion_rate ?? 0) / 1000,
      estCommission: est,
      settleCommission: status === 3 ? est : 0,
      status,
      orderTime: ts(r.order_create_time ?? r.order_pay_time ?? r.create_time) ?? new Date(),
      settleTime: ts(r.order_settle_time ?? r.settle_time),
      raw: r,
    };
  }

  // ───────────────────────── 内部工具 ─────────────────────────

  /** 从一段乱七八糟的分享文本里挖出 goods_sign */
  private async resolveGoodsSign(text: string): Promise<string | null> {
    const direct = /goods_sign=([A-Za-z0-9_\-]+)/.exec(text);
    if (direct) return direct[1];

    const byId = /goods_id=(\d{6,})/.exec(text);
    if (byId) return this.signByGoodsId(byId[1]);

    const url = /https?:\/\/[^\s"'，。）)]+/.exec(text);
    if (url) {
      const final = await this.followRedirect(url[0]);
      if (final && final !== url[0]) {
        const s2 = /goods_sign=([A-Za-z0-9_\-]+)/.exec(final);
        if (s2) return s2[1];
        const i2 = /goods_id=(\d{6,})/.exec(final);
        if (i2) return this.signByGoodsId(i2[1]);
      }
    }

    // 纯数字兜底：用户直接贴了商品 ID
    const bare = /^\s*(\d{9,})\s*$/.exec(text);
    if (bare) return this.signByGoodsId(bare[1]);

    return null;
  }

  /** goods_id -> goods_sign，用搜索接口兜底 */
  private async signByGoodsId(goodsId: string): Promise<string | null> {
    try {
      const data = await this.call<any>('/pdd/goods_search', {
        keyword: goodsId,
        page: 1,
        page_size: 10,
        pid: this.opt.pid,
      });
      const rawList = data?.list ?? data?.goods_list ?? (Array.isArray(data) ? data : []);
      const hit = rawList.find((g: any) => String(g.goods_id) === goodsId) ?? rawList[0];
      return hit?.goods_sign ?? null;
    } catch (e: any) {
      this.logger.warn(`goods_id ${goodsId} 换 goods_sign 失败: ${e.message}`);
      return null;
    }
  }

  /** 跟 302，最多 5 跳 */
  private async followRedirect(url: string, hop = 0): Promise<string | null> {
    if (hop > 5) return url;
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        },
      });
      const loc = res.headers.get('location');
      if (loc) {
        const next = new URL(loc, url).toString();
        return this.followRedirect(next, hop + 1);
      }
      return url;
    } catch {
      return null;
    }
  }
}
