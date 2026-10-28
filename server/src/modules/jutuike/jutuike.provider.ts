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
  shortH5: string;
  /** App 唤起协议（飞猪/淘宝/支付宝 scheme），有则直接唤起，避免走 H5 中转页多次跳转 */
  deeplink: string;
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

  private async call<T>(path: string, params: Record<string, any>, method: 'GET' | 'POST' = 'GET'): Promise<T> {
    const json = await this.callRaw(path, params, method);
    if (json.code !== 1 && json.code !== 200) {
      const msg = json.msg || json.message || '';
      // 无数据属于业务正常情况，返回空数据结构而不是抛错
      if (msg.includes('无数据') || msg.includes('没有数据')) {
        return { data: [], total: 0, current_page: 1, last_page: 1, per_page: 20 } as any;
      }
      throw new Error(`聚推客接口错误: ${msg || JSON.stringify(json)}`);
    }
    return json.data as T;
  }

  private async callRaw(path: string, params: Record<string, any>, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    if (!this.opt.apiKey) {
      throw new Error('聚推客未配置：请在 .env 填 JTK_API_KEY');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      let url: string;
      let body: string | undefined;
      const allParams = { apikey: this.opt.apiKey, ...params };
      const filtered = Object.fromEntries(
        Object.entries(allParams).filter(([, v]) => v !== undefined && v !== null && v !== ''),
      );

      if (method === 'GET') {
        url = `${this.baseUrl}${path}?` + Object.entries(filtered)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
      } else {
        url = `${this.baseUrl}${path}`;
        body = new URLSearchParams(filtered as any).toString();
      }

      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: method === 'POST'
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : { 'Content-Type': 'application/json' },
        body,
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
    this.logger.warn(
      `[飞猪转链原始返回] act_id=${actId} sid=${sid} keys=${Object.keys(data).join(',')} raw=${JSON.stringify(data).slice(0, 1500)}`,
    );
    const weApp = data.we_app_info;
    return {
      h5: data.h5 || '',
      longH5: data.long_h5 || '',
      shortH5: data.short_h5 || '',
      deeplink: data.deeplink || data.deep_link || data.schema || data.scheme || '',
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

  // ─── 饿了么 ───

  /**
   * 饿了么活动列表
   */
  async eleList(params: { page?: number; pageSize?: number }): Promise<{
    list: any[]; total: number; page: number; pageSize: number; lastPage: number;
  }> {
    const data: any = await this.call('/ele/getEleCouponList', {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    }, 'POST');
    return {
      list: (data.data || []).map((r: any) => ({
        actId: String(r.coupon_id || ''),
        actName: r.xcx_short_title || r.short_title || r.title || '',
        desc: r.title || '',
        img: r.bg_images || '',
        icon: r.icon || '',
        commissionRate: r.commission_rate_des || '',
        startTime: r.start_time || '',
        endTime: r.end_time || '',
      })),
      total: Number(data.total || 0),
      page: Number(data.current_page || 1),
      pageSize: Number(data.per_page || 20),
      lastPage: Number(data.last_page || 1),
    };
  }

  /**
   * 饿了么活动转链
   *
   * 饿了么活动可能有多种跳转方式，按优先级返回：
   * 1. h5_promotion.tj_h5_url — 饿了么 H5
   * 2. taobao_promotion.h5_url — 淘宝 H5
   * 3. alipay_promotion.h5_url — 支付宝 H5
   * 4. 小程序码/二维码（微信、淘宝、支付宝）
   */
  async eleConvert(activityId: string, sid: string): Promise<{
    h5: string;
    actName: string;
    // 各端链接
    taobaoH5?: string;
    alipayH5?: string;
    // 小程序/APP 跳转
    weAppInfo: { appId: string; pagePath: string; miniCode: string } | null;
    taobaoInfo?: {
      h5Url: string;
      schemeUrl: string;
      qrCode: string;
      tbToken: string;
      tbWord: string;
    };
    alipayInfo?: {
      h5Url: string;
      schemeUrl: string;
      qrCode: string;
    };
    // 全部原始 link 数据（兜底用）
    rawLink?: any;
  }> {
    const data: any = await this.call('/ele/kbact', {
      activity_id: activityId,
      sid,
    }, 'POST');

    const link = data.link || {};
    const h5Promo = link.h5_promotion || {};
    const wx = link.wx_promotion || {};
    const tb = link.taobao_promotion || {};
    const alipay = link.alipay_promotion || {};

    // 主 H5 优先级：饿了么 H5 > 淘宝 H5 > 支付宝 H5
    const h5 = h5Promo.tj_h5_url
      || tb.h5_url
      || alipay.h5_url
      || '';

    const result: any = {
      h5,
      actName: data.title || data.description || '',
      weAppInfo: wx.wx_app_id ? {
        appId: wx.wx_app_id || '',
        pagePath: wx.wx_path || '',
        miniCode: wx.wx_qr_code || '',
      } : null,
      rawLink: link,
    };

    // 淘宝相关
    if (tb.h5_url || tb.tb_qr_code) {
      result.taobaoH5 = tb.h5_url || '';
      result.taobaoInfo = {
        h5Url: tb.h5_url || '',
        schemeUrl: tb.scheme_url || tb.tb_scheme_url || '',
        qrCode: tb.tb_qr_code || tb.img_url || '',
        tbToken: tb.tb_watchword || '',
        tbWord: tb.taobao_word || tb.tb_watchword_suggest || '',
      };
    }

    // 支付宝相关
    if (alipay.h5_url || alipay.alipay_qr_code) {
      result.alipayH5 = alipay.h5_url || '';
      result.alipayInfo = {
        h5Url: alipay.h5_url || '',
        schemeUrl: alipay.alipay_scheme_url || alipay.scheme_url || '',
        qrCode: alipay.alipay_qr_code || alipay.img_url || '',
      };
    }

    return result;
  }

  /**
   * 饿了么订单查询
   *
   * 状态：3-订单结算 12-订单付款 13-订单失效 14-订单成功
   */
  async fetchEleOrders(params: {
    start?: Date;
    end?: Date;
    page?: number;
    pageSize?: number;
    queryType?: number;
    sid?: string;
    type?: number;
    tkStatus?: number;
  }): Promise<{ list: UnifiedOrder[]; total: number; page: number; pageSize: number; lastPage: number }> {
    const fmt = (d?: Date) => {
      if (!d) return undefined;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const query: Record<string, any> = {
      page: params.page || 1,
      pageSize: params.pageSize || 100,
    };
    if (params.start) query.start_time = fmt(params.start);
    if (params.end) query.end_time = fmt(params.end);
    if (params.queryType !== undefined) query.query_type = params.queryType;
    if (params.sid) query.sid = params.sid;
    if (params.type !== undefined) query.type = params.type;
    if (params.tkStatus !== undefined) query.tk_status = params.tkStatus;

    const data: any = await this.call('/Ele/orders', query, 'GET');
    const list: UnifiedOrder[] = (data.data || []).map((r: any) => this.mapEleOrder(r));
    return {
      list,
      total: Number(data.total || 0),
      page: Number(data.current_page || 1),
      pageSize: Number(data.per_page || 100),
      lastPage: Number(data.last_page || 1),
    };
  }

  /**
   * 饿了么订单 → 统一订单
   *
   * 状态映射：
   * - 12 订单付款 → 已付款(1)
   * - 14 订单成功 → 已收货(2)
   * - 3  订单结算 → 已结算(3)
   * - 13 订单失效 → 已失效(4)
   */
  private mapEleOrder(r: any): UnifiedOrder {
    const rawStatus = Number(r.tk_status);
    let status = 1;
    if (rawStatus === 3) status = 3;
    else if (rawStatus === 14) status = 2;
    else if (rawStatus === 12) status = 1;
    else if (rawStatus === 13) status = 4;

    const est = Number(r.jtk_share_fee || 0);
    const settle = status === 3 ? est : 0;

    return {
      platform: 'JTK',
      platformOrderNo: String(r.trade_id || ''),
      subOrderNo: String(r.trade_parent_id || ''),
      positionId: r.sid || '',
      goodsId: '',
      goodsTitle: r.item_title || '',
      goodsImg: r.item_img ? (r.item_img.startsWith('http') ? r.item_img : `https:${r.item_img}`) : '',
      payAmount: Number(r.alipay_total_price || 0),
      commissionRate: Number(r.jtk_share_rate || 0),
      estCommission: est,
      settleCommission: settle,
      status,
      orderTime: r.tk_create_time ? new Date(r.tk_create_time) : new Date(),
      payTime: r.tk_paid_time ? new Date(r.tk_paid_time) : undefined,
      settleTime: status === 3 && r.tk_earning_time ? new Date(r.tk_earning_time) : undefined,
      raw: {
        ...r,
        brand_id: 2, // 饿了么
        source: 'ele',
        item_category_name: r.item_category_name,
        seller_nick: r.seller_nick,
        refund_tag: r.refund_tag,
        type: r.type,
        click_time: r.click_time,
      },
    };
  }

  // ─── 美团券包 ───

  /**
   * 美团券包活动列表
   */
  async mtCouponList(params: { page?: number; pageSize?: number }): Promise<{
    list: any[]; total: number; page: number; pageSize: number; lastPage: number;
  }> {
    const data: any = await this.call('/Meituan/coupon_ad_list', {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    }, 'POST');
    return {
      list: (data.data || []).map((r: any) => ({
        actId: String(r.coupon_id || ''),
        actName: r.xcx_short_title || r.title || '',
        desc: r.title || '',
        img: r.bg_images || '',
        icon: r.icon || '',
        poster: r.poster || '',
        commissionRate: r.commission_rate_des || '',
        activityDate: r.activity_date || '',
      })),
      total: Number(data.total || 0),
      page: Number(data.current_page || 1),
      pageSize: Number(data.per_page || 20),
      lastPage: Number(data.last_page || 1),
    };
  }

  /**
   * 美团券包转链（type=15 美团券包）
   *
   * 返回所有可用的跳转方式，优先级：H5 > 小程序码 > deeplink
   */
  async mtCouponConvert(actId: string, sid: string): Promise<{
    h5: string;
    shortH5: string;
    longH5?: string;
    deeplink: string;
    actName: string;
    weAppInfo: { appId: string; pagePath: string; miniCode: string } | null;
    // 美团小程序/APP 信息
    mtAppInfo?: {
      appId?: string;
      pagePath?: string;
      miniCode?: string;
    };
    // 原始数据兜底
    raw?: any;
  }> {
    const data: any = await this.call('/Meituan/act', {
      type: 15,
      actId,
      sid,
    }, 'GET');

    const weApp = data.we_app_info;
    const mtApp = data.mt_app_info || data.meituan_app_info || {};

    // H5 优先级：短链 > 长链
    const h5 = data.h5 || data.short_h5 || data.long_h5 || '';

    return {
      h5,
      shortH5: data.short_h5 || '',
      longH5: data.long_h5 || '',
      deeplink: data.deeplink || data.deep_link || '',
      actName: data.act_name || data.title || '',
      weAppInfo: weApp ? {
        appId: weApp.app_id || '',
        pagePath: weApp.page_path || '',
        miniCode: weApp.miniCode || weApp.mini_code || '',
      } : null,
      mtAppInfo: (mtApp.app_id || mtApp.miniCode || mtApp.mini_code) ? {
        appId: mtApp.app_id || '',
        pagePath: mtApp.page_path || mtApp.pagePath || '',
        miniCode: mtApp.miniCode || mtApp.mini_code || mtApp.qr_code || '',
      } : undefined,
      raw: data,
    };
  }
}
