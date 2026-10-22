import { Logger } from '@nestjs/common';
import { UnifiedOrder } from '../cps/cps.types';

const DEFAULT_BASE = 'https://api.jutuike.com';
const FETCH_TIMEOUT_MS = 30000;

export interface JutuikeOptions {
  /** 聚推客 API Key */
  apiKey: string;
  /** 自定义 baseUrl */
  baseUrl?: string;
}

export interface JtkActivity {
  actId: number;
  actName: string;
  desc: string;
  img: string;
  icon: string;
  poster: string;
  startDate: string;
  endDate: string;
  introduce: string;
  attributionExplain: string;
  note: string;
  settlementTime: string;
}

export interface JtkConvertResult {
  h5: string;
  longH5: string;
  weAppInfo: {
    appId: string;
    pagePath: string;
    miniCode: string;
  } | null;
  actName: string;
}

export interface JtkOrder {
  actId: number;
  actName: string;
  sid: string;
  pubId: number;
  jtkShareRate: string;
  jtkShareFee: string;
  orderSn: string;
  orderTitle: string;
  createTime: string;
  payTime: string;
  modifiedTime: string;
  orderPrice: string;
  payPrice: string;
  status: number;
  statusDesc: string;
  extension: string;
  brandId: number;
  invalidReason: string;
  icon: string;
}

/**
 * 聚推客联盟 API 封装。
 *
 * 覆盖 30+ 本地生活品牌：美团外卖、饿了么、滴滴打车、酒店、电影票、话费充值等。
 * 推广模式是活动分发（不是商品搜索）：活动列表 → 转链 → 用户跳转平台下单 → 拿佣金。
 *
 * 文档: https://www.jutuike.com/document
 */
export class JutuikeProvider {
  readonly platform = 'JTK';
  private readonly logger = new Logger(JutuikeProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly opt: JutuikeOptions) {
    this.baseUrl = opt.baseUrl || DEFAULT_BASE;
  }

  // ─── 基础 HTTP 封装 ───

  private async call<T>(path: string, params: Record<string, any>): Promise<T> {
    const json = await this.callRaw(path, params);
    if (json.code !== 1 && json.code !== 200) {
      throw new Error(`聚推客接口错误: ${json.msg || json.message || JSON.stringify(json)}`);
    }
    return json.data as T;
  }

  private async callRaw(path: string, params: Record<string, any>): Promise<any> {
    if (!this.opt.apiKey) {
      throw new Error('聚推客未配置：请在 .env 填 JTK_API_KEY');
    }
    const url = `${this.baseUrl}${path}?apikey=${encodeURIComponent(this.opt.apiKey)}`
      + '&' + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      return JSON.parse(text);
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('聚推客接口超时');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── 活动列表 ───

  /**
   * 获取聚推客联盟活动列表
   * @param params.cate_name 分类名：饿了么、美团、打车出行、特惠酒店、电影票等
   */
  async actList(params: {
    page?: number;
    pageSize?: number;
    cateName?: string;
    xcxSpread?: number;
  }): Promise<{ list: JtkActivity[]; total: number; page: number; pageSize: number; lastPage: number }> {
    const data: any = await this.call('/union/act_list', {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      cate_name: params.cateName || '',
      xcx_spread: params.xcxSpread ?? 0,
    });
    return {
      list: (data.data || []).map((r: any) => this.mapActivity(r)),
      total: Number(data.total || 0),
      page: Number(data.current_page || 1),
      pageSize: Number(data.per_page || 20),
      lastPage: Number(data.last_page || 1),
    };
  }

  private mapActivity(r: any): JtkActivity {
    return {
      actId: Number(r.act_id || 0),
      actName: r.act_name || '',
      desc: r.desc || '',
      img: r.img || '',
      icon: r.icon || '',
      poster: r.poster || '',
      startDate: r.start_date || '',
      endDate: r.end_date || '',
      introduce: r.introduce || '',
      attributionExplain: r.attribution_explain || '',
      note: r.note || '',
      settlementTime: r.settlement_time || '',
    };
  }

  // ─── 活动转链 ───

  /**
   * 活动转链：生成带 sid（自定义跟单参数）的推广链接
   * @param actId 活动ID
   * @param sid 自定义跟单参数（用户 positionId）
   */
  async convertAct(actId: number, sid: string): Promise<JtkConvertResult> {
    const data: any = await this.call('/union/act', {
      act_id: actId,
      sid,
    });
    const weApp = data.we_app_info;
    return {
      h5: data.h5 || '',
      longH5: data.long_h5 || '',
      actName: data.act_name || '',
      weAppInfo: weApp ? {
        appId: weApp.app_id || '',
        pagePath: weApp.page_path || '',
        miniCode: weApp.miniCode || '',
      } : null,
    };
  }

  // ─── 订单拉取 ───

  /**
   * 拉取订单。
   *
   * 注意：聚推客订单接口时间范围不能超过 1 小时，外部调用方需要自行拆段。
   *
   * @param start 开始时间
   * @param end 结束时间（与 start 相差不超过 1 小时）
   * @param page 页码
   * @param queryType 查询类型：1按支付时间 2按更新时间 3按创建时间（默认3）
   * @param brandId 品牌ID，不传则全部
   */
  async fetchOrders(
    start: Date,
    end: Date,
    page = 1,
    queryType = 2,
    brandId?: number,
  ): Promise<{ list: UnifiedOrder[]; total: number; page: number; pageSize: number; lastPage: number }> {
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const params: Record<string, any> = {
      start_time: fmt(start),
      end_time: fmt(end),
      query_type: queryType,
      page,
      pageSize: 100,
    };
    if (brandId !== undefined) params.brand_id = brandId;

    const data: any = await this.call('/union/orders', params);
    const list: UnifiedOrder[] = (data.data || []).map((r: any) => this.mapOrder(r));
    return {
      list,
      total: Number(data.total || 0),
      page: Number(data.current_page || 1),
      pageSize: Number(data.per_page || 100),
      lastPage: Number(data.last_page || 1),
    };
  }

  /**
   * 聚推客订单状态 → 系统统一状态
   *
   * 聚推客：0未付款 1已付款 2待结算 3已结算 4无效订单
   * 系统：   1已付款 2已收货 3已结算 4已失效
   *
   * 映射逻辑：
   * - 未付款(0) → 已付款(1)（未付款的订单一般不落库或忽略，但这里统一映射）
   * - 已付款(1) → 已付款(1)
   * - 待结算(2) → 已收货(2)（类比电商的"确认收货后待结算"阶段）
   * - 已结算(3) → 已结算(3)
   * - 无效(4) → 已失效(4)
   */
  private mapOrder(r: any): UnifiedOrder {
    const rawStatus = Number(r.status);
    let status = 1;
    if (rawStatus === 3) status = 3;
    else if (rawStatus === 2) status = 2;
    else if (rawStatus === 1 || rawStatus === 0) status = 1;
    else if (rawStatus === 4) status = 4;

    const est = Number(r.jtk_share_fee || 0);
    const settle = status === 3 ? est : 0;

    return {
      platform: 'JTK',
      platformOrderNo: String(r.order_sn || ''),
      subOrderNo: '',
      positionId: r.sid || '',
      goodsId: String(r.act_id || ''),
      goodsTitle: r.order_title || r.act_name || '',
      goodsImg: r.icon || '',
      payAmount: Number(r.pay_price || r.order_price || 0),
      commissionRate: Number(r.jtk_share_rate || 0),
      estCommission: est,
      settleCommission: settle,
      status,
      orderTime: r.create_time ? new Date(r.create_time) : new Date(),
      settleTime: status === 3 && r.modified_time ? new Date(r.modified_time) : undefined,
      raw: {
        ...r,
        brand_id: r.brand_id,
        act_name: r.act_name,
        status_desc: r.status_desc,
        invalid_reason: r.invalid_reason,
        extension: r.extension,
      },
    };
  }
}
