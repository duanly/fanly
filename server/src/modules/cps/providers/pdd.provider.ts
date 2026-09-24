import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ConvertedLink, CpsProvider, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

export interface PddOptions {
  clientId: string;
  clientSecret: string;
  /** 多多进宝推广位 ID，形如 44814283_318146216 */
  pid: string;
  gateway?: string;
}

const DEFAULT_GATEWAY = 'https://gw-api.pinduoduo.com/api/router';

/** 分 -> 元 */
const yuan = (v: any) => Math.round(Number(v ?? 0)) / 100;
const round2 = (v: number) => Math.round(v * 100) / 100;

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
 * 拼多多（多多进宝）直连渠道。
 *
 * 为什么直连不走聚合：拼多多是四家里唯一不需要用户授权、不需要渠道备案
 * 就能做订单归属的——转链时把 custom_parameters 带上，拉单时原样回来。
 * 少一层聚合商，佣金不被抽成，故障面也小。
 *
 * 网关：POST application/x-www-form-urlencoded 到 /api/router
 * 签名：MD5(secret + 按 key 升序拼接的 key+value + secret)，结果转大写
 */
export class PddProvider implements CpsProvider {
  readonly platform = 'PDD';
  private readonly logger = new Logger(PddProvider.name);
  private readonly gateway: string;

  constructor(private readonly opt: PddOptions) {
    this.gateway = opt.gateway || DEFAULT_GATEWAY;
  }

  // ───────────────────────── 网关 ─────────────────────────

  private sign(params: Record<string, string>): string {
    const keys = Object.keys(params).sort();
    let raw = this.opt.clientSecret;
    for (const k of keys) raw += k + params[k];
    raw += this.opt.clientSecret;
    return createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
  }

  private async call<T = any>(type: string, biz: Record<string, any> = {}): Promise<T> {
    if (!this.opt.clientId || !this.opt.clientSecret) {
      throw new Error('拼多多未配置：请在 .env 填 PDD_CLIENT_ID / PDD_CLIENT_SECRET');
    }

    const params: Record<string, string> = {
      type,
      client_id: this.opt.clientId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      data_type: 'JSON',
    };
    for (const [k, v] of Object.entries(biz)) {
      if (v === undefined || v === null || v === '') continue;
      params[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    params.sign = this.sign(params);

    const res = await fetch(this.gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`拼多多网关 HTTP ${res.status}`);

    const json: any = await res.json();
    if (json.error_response) {
      const e = json.error_response;
      throw new Error(
        `拼多多 ${type} 报错 ${e.error_code}: ${e.error_msg}${e.sub_msg ? ' / ' + e.sub_msg : ''}`,
      );
    }
    // 响应外层 key 形如 goods_search_response。
    // 不能无脑取第一个 key——有些接口会在同级塞 request_id。
    const keys = Object.keys(json);
    const key = keys.find((k) => k.endsWith('_response')) ?? keys[0];
    return (key ? json[key] : json) as T;
  }

  // ───────────────────────── 字段映射 ─────────────────────────

  /**
   * 注意 goodsId 存的是 goods_sign 不是 goods_id。
   * 2021 年之后拼多多的转链、详情接口只认 goods_sign，goods_id 已弃用。
   */
  private mapGoods(r: any): UnifiedGoods {
    const price = yuan(r.min_group_price ?? r.min_normal_price);
    const coupon = r.has_coupon ? yuan(r.coupon_discount) : 0;
    const couponPrice = round2(Math.max(price - coupon, 0));
    const rate = Number(r.promotion_rate ?? 0) / 1000; // 千分比

    return {
      platform: 'PDD',
      goodsId: String(r.goods_sign ?? r.goods_id ?? ''),
      title: r.goods_name ?? '',
      image: r.goods_thumbnail_url || r.goods_image_url || '',
      shopName: r.mall_name || r.merchant_name || r.mall_name_v2 || '',
      price,
      couponPrice,
      couponAmount: coupon,
      commissionRate: rate,
      commission: round2(couponPrice * rate),
      salesVolume: parseSales(r.sales_tip ?? r.sold_quantity),
    };
  }

  /**
   * 拼多多订单状态：
   *   -1 已取消 / 0 已支付 / 1 已成团 / 2 确认收货 / 3 审核成功
   *   / 4 审核失败 / 5 已结算 / 8 非多多进宝商品 / 10 已处罚
   * 归一到我们的 1 已付款 / 2 已收货 / 3 已结算 / 4 已失效
   */
  private mapOrder(r: any): UnifiedOrder {
    const st = Number(r.order_status);
    const status = st === 5 ? 3
      : st === 2 || st === 3 ? 2
      : st === 0 || st === 1 ? 1
      : 4;

    // 转链时塞进去的 {"uid":"..."} 在这儿原样回来，订单归属全靠它
    let positionId = '';
    const cp = r.custom_parameters;
    if (cp) {
      try { positionId = JSON.parse(cp).uid ?? ''; } catch { positionId = String(cp); }
    }

    const est = yuan(r.promotion_amount);
    const ts = (v: any) => (v ? new Date(Number(v) * 1000) : undefined);

    return {
      platform: 'PDD',
      platformOrderNo: String(r.order_sn ?? ''),
      subOrderNo: String(r.order_sn ?? ''),
      positionId,
      goodsId: String(r.goods_id ?? ''),
      goodsTitle: r.goods_name ?? '',
      goodsImg: r.goods_thumbnail_url ?? '',
      payAmount: yuan(r.order_amount),
      commissionRate: Number(r.promotion_rate ?? 0) / 1000,
      estCommission: est,
      // 只有真正结算了才认，否则分佣基数会虚高
      settleCommission: status === 3 ? est : 0,
      status,
      orderTime: ts(r.order_create_time ?? r.order_pay_time) ?? new Date(),
      settleTime: ts(r.order_settle_time),
      raw: r,
    };
  }

  // ───────────────────────── CpsProvider ─────────────────────────

  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    const sortMap: Record<string, number> = { sales: 6, commission: 14, price: 10 };
    const data = await this.call<any>('pdd.ddk.goods.search', {
      keyword: p.keyword,
      page: p.page ?? 1,
      page_size: Math.min(p.pageSize ?? 20, 100),
      sort_type: sortMap[p.sort ?? ''] ?? 0,
      pid: this.opt.pid,
    });
    return (data?.goods_list ?? []).map((r: any) => this.mapGoods(r));
  }

  /**
   * 官方榜单 / 推荐位。
   *
   * 首页 feed 不该用关键词搜索凑——搜出来的东西质量参差。拼多多的
   * 「实时收益榜」天然按收益排，正好是返利站要的东西。
   *
   * 注意：channel_type 的取值文档里给了一串（1.9包邮/今日爆款/品牌清仓…），
   * 这里只用默认频道；要开别的频道先用 probe-pdd.js 实测，别照抄数字。
   */
  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    const limit = Math.min(p.pageSize ?? 20, 100);
    const offset = (Math.max(p.page ?? 1, 1) - 1) * limit;

    if (p.channel === 'pick') {
      const data = await this.call<any>('pdd.ddk.goods.recommend.get', {
        channel_type: 3, offset, limit, pid: this.opt.pid,
      });
      return (data?.list ?? data?.goods_list ?? []).map((r: any) => this.mapGoods(r));
    }

    // sort_type: 1 实时热销榜 / 2 实时收益榜
    const data = await this.call<any>('pdd.ddk.top.goods.list.query', {
      sort_type: p.channel === 'hot' ? 1 : 2,
      offset, limit, p_id: this.opt.pid,
    });
    return (data?.list ?? data?.goods_list ?? []).map((r: any) => this.mapGoods(r));
  }

  async getGoodsDetail(goodsSign: string): Promise<UnifiedGoods | null> {
    if (!goodsSign) return null;
    const data = await this.call<any>('pdd.ddk.goods.detail', {
      goods_sign: goodsSign,
      pid: this.opt.pid,
    });
    const item = data?.goods_details?.[0];
    return item ? this.mapGoods(item) : null;
  }

  async convertLink(goodsSign: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.pid) throw new Error('拼多多未配置推广位：请在 .env 填 PDD_PID');

    // custom_parameters 有 64 字节硬上限，超了整个转链会失败
    const custom = JSON.stringify({ uid: positionId });
    if (Buffer.byteLength(custom, 'utf8') > 64) {
      throw new Error(`custom_parameters 超长(${Buffer.byteLength(custom)}B)，positionId 需要缩短`);
    }

    const data = await this.call<any>('pdd.ddk.goods.promotion.url.generate', {
      p_id: this.opt.pid,
      goods_sign_list: [goodsSign],
      custom_parameters: custom,
      generate_short_url: true,
      generate_schema_url: true,
      generate_mobile: true,
    });

    const u = data?.goods_promotion_url_list?.[0];
    if (!u) throw new Error('拼多多转链返回为空，检查该商品是否还在多多进宝推广中');

    return {
      platform: 'PDD',
      goodsId: goodsSign,
      shortUrl: u.mobile_short_url || u.short_url || u.mobile_url || u.url || '',
      deeplink: u.schema_url || u.mobile_url || '',
      password: '', // 拼多多没有淘口令那种东西，分享的就是短链
      positionId,
    };
  }

  /**
   * 分享内容解析。
   * 拼多多没有官方口令解析接口，靠自己从文本里抠 goods_sign / goods_id，
   * 短链则跟一次 302 拿到真实地址。
   */
  async parseContent(text: string): Promise<UnifiedGoods | null> {
    const sign = await this.resolveGoodsSign(text);
    if (!sign) return null;
    return this.getGoodsDetail(sign);
  }

  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    // 拼多多要求区间不超过 24 小时，超了直接报参数错误
    const MAX = 24 * 3600 * 1000;
    const s = Math.floor(start.getTime() / 1000);
    const e = Math.floor(Math.min(end.getTime(), start.getTime() + MAX) / 1000);

    const data = await this.call<any>('pdd.ddk.order.list.increment.get', {
      start_update_time: s,
      end_update_time: e,
      page,
      page_size: 100,
      return_count: true,
    });
    return (data?.order_list ?? []).map((r: any) => this.mapOrder(r));
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

  /**
   * goods_id -> goods_sign。
   * 拼多多没给现成的换算接口，但搜索接口拿 goods_id 当关键词能搜到本品。
   */
  private async signByGoodsId(goodsId: string): Promise<string | null> {
    try {
      const data = await this.call<any>('pdd.ddk.goods.search', {
        keyword: goodsId,
        page: 1,
        page_size: 10,
        pid: this.opt.pid,
      });
      const list: any[] = data?.goods_list ?? [];
      const hit = list.find((g) => String(g.goods_id) === goodsId) ?? list[0];
      return hit?.goods_sign ?? null;
    } catch (e: any) {
      this.logger.warn(`goods_id ${goodsId} 换 goods_sign 失败: ${e.message}`);
      return null;
    }
  }

  /** 跟 302，最多 5 跳，只为了把短链还原成带 goods_id 的长链 */
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
