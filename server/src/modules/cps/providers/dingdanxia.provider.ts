import { Logger } from '@nestjs/common';
import {
  ConvertedLink, CpsProvider, GoodsPage, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

export interface DingdanxiaOptions {
  apiKey: string;
  /** 淘宝 PID（mm_xxx_xxx_xxx），转链必填 */
  pid?: string;
  baseUrl?: string;
}

const DEFAULT_BASE = 'https://api.tbkapi.com';

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * 订单侠（dingdanxia）淘宝联盟聚合渠道。
 *
 * 为什么用聚合而不是直连淘宝联盟：
 *   1. 淘宝联盟要备案网站/APP + 审核，个人开发者很难过
 *   2. 订单侠帮你搞定了联盟授权，你只管调他们的 API
 *   3. 功能比直连还多（商品历史价、品牌库、文案素材等）
 *
 * 字段口径（淘宝/订单侠）：
 *   - 金额单位：**元**，跟京东一致，跟拼多多（分）相反
 *   - 佣金比例：**百分数**（20.5 = 20.5%），跟京东一致
 *   - 券后价：`final_price`（券后价）或 `zk_final_price - coupon_amount`
 *   - 佣金：`commission_rate` 是百分数，`commission` 是预估佣金金额
 */
export class DingdanxiaProvider implements CpsProvider {
  readonly platform = 'TB';
  private readonly logger = new Logger(DingdanxiaProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly opt: DingdanxiaOptions) {
    this.baseUrl = opt.baseUrl || DEFAULT_BASE;
  }

  // ───────────────────────── 网关 ─────────────────────────

  private async call<T>(path: string, params: Record<string, any>): Promise<T> {
    if (!this.opt.apiKey) {
      throw new Error('订单侠未配置：请在 .env 填 DDX_API_KEY');
    }
    const url = new URL(path, this.baseUrl);
    Object.entries({ ...params, apikey: this.opt.apiKey }).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error(`订单侠 ${path} HTTP ${res.status}`);
    const json: any = await res.json();
    // 订单侠 code 约定：0 成功，非 0 失败
    if (json.code !== undefined && json.code !== 0) {
      throw new Error(`订单侠 ${path}: ${json.code} ${json.msg || json.message || ''}`);
    }
    return (json.data ?? json.result ?? json) as T;
  }

  // ───────────────────────── 字段映射 ─────────────────────────

  private mapGoods(raw: any): UnifiedGoods {
    const price = Number(raw.zk_final_price ?? raw.original_price ?? 0);
    const couponAmount = Number(raw.coupon_amount ?? raw.coupon_price ?? 0);
    const couponPrice = raw.final_price
      ? Number(raw.final_price)
      : Math.max(price - couponAmount, 0);

    // commission_rate 是百分数字符串，比如 "20.50" 表示 20.5%
    const rate = Number(raw.commission_rate ?? raw.promotion_rate ?? 0) / 100;
    const commission = Number(raw.commission ?? raw.promotion_amount ?? 0);

    return {
      platform: 'TB',
      goodsId: String(raw.item_id ?? raw.goods_id ?? raw.id ?? ''),
      title: raw.title ?? raw.goods_name ?? '',
      image: raw.pict_url ?? raw.goods_thumbnail_url ?? raw.main_pic ?? '',
      shopName: raw.shop_title ?? raw.mall_name ?? raw.shop_name ?? '',
      price: round2(price),
      couponPrice: round2(couponPrice),
      couponAmount: round2(couponAmount),
      commissionRate: rate,
      commission: commission > 0 ? round2(commission) : round2(couponPrice * rate),
      salesVolume: Number(raw.volume ?? raw.sales_tip ?? raw.month_sales ?? 0),
    };
  }

  // ───────────────────────── CpsProvider ─────────────────────────

  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    return (await this.searchGoodsPage(p)).list;
  }

  async searchGoodsPage(p: SearchParams): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(Math.max(p.pageSize ?? 20, 1), 100);
    const sortMap: Record<string, string> = {
      sales: 'total_sales_des',         // 销量降序
      commission: 'tk_rate_des',        // 佣金比例降序
      price: 'price_des',               // 价格降序（没有升序，凑合用）
    };

    const params: Record<string, any> = {
      page,
      page_size: pageSize,
      sort: sortMap[p.sort ?? ''] ?? 'tk_total_sales_des',
    };
    if (p.keyword) params.q = p.keyword;

    const data = await this.call<any>('/api/taobao/item_search', params);
    const list = (data?.list ?? data ?? []).map((r: any) => this.mapGoods(r));
    const total = Number(data?.total_count ?? data?.total ?? 0);
    return {
      list,
      total,
      page,
      hasMore: page * pageSize < total,
    };
  }

  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    return (await this.recommendGoodsPage(p)).list;
  }

  /**
   * 榜单/推荐。订单侠有"热门榜单""实时销量"等接口。
   * 这里统一走 item_search 的不同排序来模拟，简单够用。
   */
  async recommendGoodsPage(p: RecommendParams = {}): Promise<GoodsPage> {
    const channelMap: Record<string, string> = {
      hot: 'total_sales_des',          // 热销
      earn: 'tk_rate_des',             // 高佣
      cheap: 'price_asc',              // 低价
      coupon: 'tk_total_sales_des',    // 好券（默认推荐）
      pick: 'tk_total_sales_des',
    };
    return this.searchGoodsPage({
      page: p.page,
      pageSize: p.pageSize,
      sort: channelMap[p.channel ?? 'coupon'] ?? 'tk_total_sales_des',
    });
  }

  async getGoodsDetail(goodsId: string): Promise<UnifiedGoods | null> {
    if (!goodsId) return null;
    const data = await this.call<any>('/api/taobao/item_detail', {
      item_id: goodsId,
    });
    const item = data?.list?.[0] ?? data?.item ?? data;
    return item ? this.mapGoods(item) : null;
  }

  async convertLink(goodsId: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.pid) throw new Error('订单侠未配置淘宝 PID：请在 .env 填 TB_PID');

    const data = await this.call<any>('/api/taobao/item_privilege', {
      item_id: goodsId,
      pid: this.opt.pid,
      // 订单侠支持 custom_parameters 传自定义跟踪参数，用于订单归属
      // 格式是 {uid: "xxx"} 的 JSON，订单返回时会原样带回
      custom_parameters: JSON.stringify({ uid: positionId }),
      // 生成淘口令
      tpwd: 1,
    });

    const shortUrl = data?.coupon_click_url ?? data?.short_url ?? data?.click_url ?? '';
    const tpwd = data?.tpwd ?? data?.password ?? data?.model ?? '';
    if (!shortUrl && !tpwd) throw new Error('订单侠转链返回为空');

    return {
      platform: 'TB',
      goodsId,
      shortUrl: shortUrl || tpwd,
      deeplink: data?.deeplink ?? data?.schema ?? shortUrl,
      password: tpwd,
      positionId,
    };
  }

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    // 先用订单侠的解析接口，能解出 itemId 就再查详情
    try {
      const data = await this.call<any>('/api/taobao/content_parse', {
        content: text,
      });
      const itemId = data?.item_id ?? data?.goods_id ?? data?.id;
      if (itemId) return this.getGoodsDetail(String(itemId));
    } catch {
      // 解析失败走本地正则兜底
    }

    // 本地兜底：从文本里提取商品 ID（淘宝商品 id 是 11 位左右的数字）
    const m = text.match(/\b(\d{10,12})\b/);
    if (m) return this.getGoodsDetail(m[1]);
    return null;
  }

  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    // 订单侠订单查询：时间用秒级时间戳，query_type 决定按什么时间查
    // 1=创建时间，2=结算时间，3=更新时间（淘客那边叫 modified_time）
    const data = await this.call<any>('/api/taobao/order_get', {
      query_type: 3,                    // 按更新时间，增量拉取用
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000),
      page_no: page,
      page_size: 100,
    });

    const list = data?.results?.publisher_order_dto ?? data?.list ?? data ?? [];
    return (Array.isArray(list) ? list : []).map((o: any) => this.mapOrder(o));
  }

  /**
   * 淘宝订单状态（tk_status）：
   *   1 - 已付款
   *   3 - 结算成功
   *   12 - 已收货/确认收货（待结算）
   *   13 - 维权成功
   *   14 - 结算失败
   * 不同版本字段名可能不一样，尽量多匹配几个
   */
  private mapOrder(o: any): UnifiedOrder {
    const tkStatus = Number(o.tk_status ?? o.order_status ?? o.status ?? 0);

    // 统一状态：1=已付款 2=已收货 3=已结算 4=已失效
    let status: number;
    switch (tkStatus) {
      case 1: status = 1; break;            // 已付款
      case 12: status = 2; break;           // 已收货（确认收货）
      case 3: status = 3; break;            // 已结算
      case 13: case 14: case 4: status = 4; break; // 失效
      default: status = tkStatus >= 3 ? 3 : tkStatus === 12 ? 2 : tkStatus === 1 ? 1 : 4;
    }

    // custom_parameters 里的 uid 是我们自己传的 positionId
    let positionId = '';
    try {
      const custom = o.custom_parameters ? JSON.parse(o.custom_parameters) : {};
      positionId = custom.uid ?? custom.positionId ?? '';
    } catch { /* 解析失败就忽略 */ }
    if (!positionId) positionId = String(o.special_id ?? o.adzone_id ?? '');

    const payAmount = Number(o.alipay_total_price ?? o.pay_price ?? o.item_price ?? 0);
    const commissionRate = Number(o.pub_share_rate ?? o.commission_rate ?? 0) / 100;
    const estCommission = Number(o.pub_share_pre_fee ?? o.commission_pre ?? 0);
    const settleCommission = Number(o.pub_share_fee ?? o.settle_amount ?? 0);

    const orderTime = o.create_time
      ? (typeof o.create_time === 'number' ? new Date(o.create_time * 1000) : new Date(o.create_time))
      : new Date();
    const settleTime = o.settle_time || o.earning_time
      ? (typeof (o.settle_time || o.earning_time) === 'number'
        ? new Date((o.settle_time || o.earning_time) * 1000)
        : new Date(o.settle_time || o.earning_time))
      : undefined;

    return {
      platform: 'TB',
      platformOrderNo: String(o.trade_id ?? o.trade_parent_id ?? o.order_sn ?? ''),
      subOrderNo: String(o.trade_id ?? o.item_id ?? ''),
      positionId,
      goodsId: String(o.item_id ?? o.goods_id ?? ''),
      goodsTitle: o.item_title ?? o.goods_name ?? o.title ?? '',
      goodsImg: o.item_img ?? o.goods_img ?? '',
      payAmount: round2(payAmount),
      commissionRate,
      estCommission: round2(estCommission),
      settleCommission: status === 3 ? round2(settleCommission || estCommission) : 0,
      status,
      orderTime,
      settleTime,
      raw: o,
    };
  }
}
