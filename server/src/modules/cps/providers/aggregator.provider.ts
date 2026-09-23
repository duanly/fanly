import { Injectable, Logger } from '@nestjs/common';
import {
  ConvertedLink, CpsProvider, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

/**
 * 聚合服务商渠道（订单侠 / 维易 / 好单库 等）骨架。
 *
 * 拿到 key 之后要做的只有三件事：
 *   1. 在 .env 填 AGG_BASE_URL / AGG_API_KEY
 *   2. 按服务商文档补齐下面 5 个 TODO 的请求路径与字段映射
 *   3. .env 把 CPS_PROVIDER 改成 aggregator
 * 业务层、数据库、分佣引擎都不用动。
 */
@Injectable()
export class AggregatorProvider implements CpsProvider {
  private readonly logger = new Logger(AggregatorProvider.name);

  constructor(
    readonly platform: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private async call<T>(path: string, params: Record<string, any>): Promise<T> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('聚合服务商未配置：请在 .env 填 AGG_BASE_URL / AGG_API_KEY');
    }
    const url = new URL(path, this.baseUrl);
    Object.entries({ ...params, apikey: this.apiKey }).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error(`聚合接口 ${path} HTTP ${res.status}`);
    const json: any = await res.json();
    if (json.code !== undefined && json.code !== 200 && json.code !== 0) {
      throw new Error(`聚合接口 ${path} 业务错误: ${json.msg || json.message}`);
    }
    return (json.data ?? json.result ?? json) as T;
  }

  // TODO 按服务商文档补字段映射
  private mapGoods(raw: any): UnifiedGoods {
    return {
      platform: this.platform,
      goodsId: String(raw.goods_id ?? raw.item_id ?? raw.skuId),
      title: raw.title ?? raw.goods_name ?? '',
      image: raw.pict_url ?? raw.goods_thumbnail_url ?? '',
      shopName: raw.shop_title ?? raw.mall_name ?? '',
      price: Number(raw.zk_final_price ?? raw.min_group_price ?? 0),
      couponPrice: Number(raw.final_price ?? raw.coupon_price ?? 0),
      couponAmount: Number(raw.coupon_amount ?? 0),
      commissionRate: Number(raw.commission_rate ?? 0) / 100,
      commission: Number(raw.commission ?? 0),
      salesVolume: Number(raw.volume ?? raw.sales_tip ?? 0),
    };
  }

  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    const data = await this.call<any>('/api/goods/search', {
      keyword: p.keyword, page: p.page ?? 1, page_size: p.pageSize ?? 20, sort: p.sort,
    });
    return (data.list ?? data ?? []).map((r: any) => this.mapGoods(r));
  }

  async getGoodsDetail(goodsId: string): Promise<UnifiedGoods | null> {
    const data = await this.call<any>('/api/goods/detail', { goods_id: goodsId });
    return data ? this.mapGoods(data.list?.[0] ?? data) : null;
  }

  async convertLink(goodsId: string, positionId: string): Promise<ConvertedLink> {
    // 关键：positionId 必须原样透传到服务商的自定义参数字段，订单归属全靠它
    const data = await this.call<any>('/api/link/convert', {
      goods_id: goodsId, custom: positionId, sub_id: positionId,
    });
    return {
      platform: this.platform,
      goodsId,
      shortUrl: data.short_url ?? data.coupon_click_url ?? '',
      deeplink: data.deeplink ?? data.schema_url ?? '',
      password: data.tpwd ?? data.password ?? '',
      positionId,
    };
  }

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    const data = await this.call<any>('/api/link/parse', { content: text });
    return data ? this.mapGoods(data.list?.[0] ?? data) : null;
  }

  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    const data = await this.call<any>('/api/order/list', {
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000),
      page, page_size: 100,
    });
    return (data.list ?? []).map((r: any) => ({
      platform: r.platform ?? this.platform,
      platformOrderNo: String(r.trade_id ?? r.order_sn),
      subOrderNo: String(r.trade_parent_id ?? ''),
      positionId: String(r.custom ?? r.sub_id ?? ''),
      goodsId: String(r.item_id ?? r.goods_id ?? ''),
      goodsTitle: r.item_title ?? r.goods_name ?? '',
      goodsImg: r.item_img ?? '',
      payAmount: Number(r.alipay_total_price ?? r.order_amount ?? 0),
      commissionRate: Number(r.commission_rate ?? 0) / 100,
      estCommission: Number(r.pub_share_pre_fee ?? r.promotion_amount ?? 0),
      settleCommission: Number(r.pub_share_fee ?? 0),
      status: this.mapStatus(r.tk_status ?? r.order_status),
      orderTime: new Date(r.create_time ?? r.order_create_time),
      settleTime: r.earning_time ? new Date(r.earning_time) : undefined,
      raw: r,
    }));
  }

  /** 各平台状态码 → 统一状态，接哪家改哪家 */
  private mapStatus(s: any): number {
    const n = Number(s);
    if ([13, 1].includes(n)) return 1;  // 已付款
    if ([14, 2].includes(n)) return 2;  // 已收货
    if ([3, 12].includes(n)) return 3;  // 已结算
    if ([0, 4, 5, 8].includes(n)) return 4; // 已失效
    return 1;
  }
}
