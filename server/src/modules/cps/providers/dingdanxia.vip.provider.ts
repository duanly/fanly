import { Logger } from '@nestjs/common';
import {
  ConvertedLink, CpsProvider, GoodsPage, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

const DEFAULT_BASE = 'https://api.tbk.dingdanxia.com';
const FETCH_TIMEOUT_MS = 30000;

export interface DingdanxiaVipOptions {
  /** 订单侠 API Key */
  apiKey: string;
  /** 唯品会推广位 PID（订单侠授权管理里的） */
  pid?: string;
  /** 自定义 baseUrl，有专线域名时填这个 */
  baseUrl?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 订单侠唯品会聚合渠道。
 *
 * 跟淘宝、京东的订单侠渠道完全对称的结构：
 *   - 搜索/榜单 → /vip/goodsList
 *   - 详情 → /vip/item_info
 *   - 转链 → /vip/id_privilege（商品ID版）+ /vip/url_privilege（URL版兜底）
 *   - 订单 → /vip/order_details
 *   - 解析 → /vip/viplink_check
 *
 * 字段映射先按文档猜，联调时根据实际返回再调整。
 */
export class DingdanxiaVipProvider implements CpsProvider {
  readonly platform = 'VIP';
  private readonly logger = new Logger(DingdanxiaVipProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly opt: DingdanxiaVipOptions) {
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
    this.logger.debug(`唯品会请求: ${url.toString()}`);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload).toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (e: any) {
      this.logger.error(`唯品会请求失败: ${url.toString()}, error: ${e.message}, cause: ${e.cause?.message ?? e.cause ?? ''}`);
      throw e;
    }
    if (!res.ok) throw new Error(`订单侠唯品会 ${path} HTTP ${res.status}`);
    const json: any = await res.json();
    if (json.code !== undefined && json.code !== 200 && json.code !== 0) {
      throw new Error(`订单侠唯品会 ${path}: ${json.code} ${json.msg || json.message || ''}`);
    }
    return json;
  }

  // ───────────────────────── 字段映射 ─────────────────────────

  private mapGoods(raw: any): UnifiedGoods {
    const goodsId = String(raw.goodsId ?? raw.goods_id ?? raw.id ?? raw.goodId ?? '');
    const title = raw.goodsName ?? raw.goods_name ?? raw.name ?? raw.title ?? '';

    // 图片：主图 + 轮播图
    let images: string[] = [];
    // goodsCarouselPictures 可能是字符串数组，也可能是对象数组
    const carousel = raw.goodsCarouselPictures
      ?? raw.goods_carousel_pictures
      ?? raw.carouselPictures
      ?? raw.pictures
      ?? raw.images
      ?? [];
    if (Array.isArray(carousel)) {
      images = carousel.map((i: any) => typeof i === 'string' ? i : (i.url ?? i.img ?? i.pic ?? i.pictureUrl ?? ''));
    }
    const image = raw.goodsMainPicture
      ?? raw.goodsThumb
      ?? raw.goods_main_picture
      ?? raw.goods_thumb
      ?? raw.mainPicture
      ?? raw.thumb
      ?? images[0]
      ?? '';
    if (image && !images.includes(image)) images.unshift(image);
    images = images.filter(Boolean);

    // 店铺/品牌：唯品会是品牌特卖，没有店铺概念，用品牌名代替
    const shopName = raw.brandName
      ?? raw.brand_name
      ?? raw.brandStoreName
      ?? raw.shopName
      ?? '';

    // 价格：marketPrice=市场价/原价，vipPrice=唯品会价（售价）
    const price = Number(
      raw.marketPrice
      ?? raw.market_price
      ?? raw.originalPrice
      ?? raw.price
      ?? 0
    );
    const vipPrice = Number(
      raw.vipPrice
      ?? raw.vip_price
      ?? raw.salePrice
      ?? raw.sellPrice
      ?? raw.goodsPrice
      ?? 0
    );

    // 优惠券/折扣：
    //   - 有 couponAmount / vipDiscount 直接用
    //   - 没有就用原价 - 售价
    let couponAmount = Number(
      raw.couponAmount
        ?? raw.coupon_amount
        ?? raw.coupon
        ?? raw.discountAmount
        ?? 0
    );
    if (!couponAmount && price > vipPrice && vipPrice > 0) {
      couponAmount = price - vipPrice;
    }
    const couponPrice = vipPrice || Math.max(price - couponAmount, 0);

    // 佣金：
    //   commission = 佣金金额（元）
    //   commissionRate = 佣金比例（百分比，如 10.5 表示 10.5%）
    const commission = Number(raw.commission ?? raw.fee ?? 0);
    const commissionRate = Number(raw.commissionRate ?? raw.commission_rate ?? raw.rate ?? 0) / 100;

    // 销量（如果有）
    const salesVolume = Number(raw.sales ?? raw.salesVolume ?? raw.soldCount ?? raw.sellNum ?? 0);

    return {
      platform: 'VIP',
      goodsId,
      title,
      image,
      images,
      shopName,
      price: round2(price),
      couponPrice: round2(couponPrice),
      couponAmount: round2(couponAmount),
      commissionRate,
      commission: round2(commission),
      salesVolume,
    };
  }

  /** 从各种返回结构里提取 list 数组 */
  private extractList(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.list)) return data.list;
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.data)) {
      return Array.isArray(data.data) ? data.data : this.extractList(data.data);
    }
    if (data.goodsList && Array.isArray(data.goodsList)) return data.goodsList;
    if (data.rows && Array.isArray(data.rows)) return data.rows;
    if (data.records && Array.isArray(data.records)) return data.records;
    return [];
  }

  // ───────────────────────── 搜索 ─────────────────────────

  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    const r = await this.searchGoodsPage(p);
    return r.list;
  }

  async searchGoodsPage(p: SearchParams): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(p.pageSize ?? 30, 100);
    const keyword = p.keyword ?? '';

    // 排序映射（字段名大写）：
    //   sales → 没找到对应字段，用 COMMISSION 代替
    //   commission → COMMISSION（佣金）
    //   price → PRICE（价格）
    const sortMap: Record<string, string> = {
      sales: 'COMMISSION',
      commission: 'COMMISSION',
      price: 'PRICE',
    };
    const fieldName = sortMap[p.sort || ''] || '';
    // 0=正序，1=逆序
    const order = p.sort === 'price' ? 0 : 1;

    // 唯品回用 offset 分页，不用 page。page=1 时 offset=0
    const offset = (page - 1) * pageSize;

    const json = await this.callRaw('/vip/goodsList', {
      keyword: keyword || undefined,
      // 没有关键词时走频道模式（出单爆款），不然接口会报"频道类型不能为空"
      channelType: keyword ? undefined : 1,
      offset,
      pageSize,
      fieldName: fieldName || undefined,
      order: fieldName ? order : undefined,
    });

    const rawList = this.extractList(json.data ?? json);
    if (rawList.length) {
      this.logger.debug(`唯品会搜索返回第一条原始数据: ${JSON.stringify(rawList[0]).slice(0, 800)}`);
    }
    const list = rawList.map((r: any) => this.mapGoods(r));
    const total = Number(json.total ?? json.totalCount ?? json.total_results ?? list.length);
    const hasMore = !!json.lastPage === false || list.length >= pageSize;

    return { list, total, page, hasMore };
  }

  // ───────────────────────── 榜单 / 推荐 ─────────────────────────

  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    const r = await this.recommendGoodsPage(p);
    return r.list;
  }

  async recommendGoodsPage(p: RecommendParams = {}): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(p.pageSize ?? 30, 100);
    const offset = (page - 1) * pageSize;

    // 唯品会 goodsList 没有单独的榜单接口，
    // 用不同排序字段来模拟：
    //   earn → 按佣金倒序（收益榜）
    //   hot → 按佣金倒序（热销榜，没有销量字段）
    //   cheap → 按价格升序（便宜榜）
    const channelMap: Record<string, { fieldName: string; order: number }> = {
      earn: { fieldName: 'COMMISSION', order: 1 },
      hot: { fieldName: 'COMMISSION', order: 1 },
      cheap: { fieldName: 'PRICE', order: 0 },
      pick: { fieldName: 'COMMISSION', order: 1 },
    };
    const cfg = channelMap[p.channel ?? 'hot'] ?? channelMap.hot;

    const json = await this.callRaw('/vip/goodsList', {
      channelType: 1, // 出单爆款频道
      offset,
      pageSize,
      fieldName: cfg.fieldName,
      order: cfg.order,
    });

    const list = this.extractList(json.data ?? json).map((r: any) => this.mapGoods(r));
    const total = Number(json.total ?? json.totalCount ?? json.total_results ?? list.length);
    const hasMore = !!json.lastPage === false || list.length >= pageSize;

    return { list, total, page, hasMore };
  }

  // ───────────────────────── 详情 ─────────────────────────

  async getGoodsDetail(goodsId: string): Promise<UnifiedGoods | null> {
    if (!goodsId) return null;
    try {
      const data = await this.call<any>('/vip/item_info', {
        goodsId,
      });
      // 详情接口可能直接返回对象，也可能返回数组里的第一条
      const list = this.extractList(data);
      const raw = (Array.isArray(data) ? data[0] : (list[0] ?? data));
      if (!raw || !raw.goodsId) return null;
      return this.mapGoods(raw);
    } catch (e: any) {
      this.logger.debug(`唯品会详情(item_info)失败: ${e.message}`);
    }

    // 兜底：搜索接口按 goodsId 搜
    try {
      const data = await this.call<any>('/vip/goodsList', {
        keyword: goodsId,
        page: 1,
        pageSize: 5,
      });
      const list = this.extractList(data);
      const hit = list.find((r: any) => String(r.goodsId ?? r.id ?? '') === goodsId) ?? list[0];
      return hit ? this.mapGoods(hit) : null;
    } catch {
      return null;
    }
  }

  // ───────────────────────── 转链 ─────────────────────────

  /**
   * 从转链接口响应里提取可用的链接。
   *
   * 唯品会跟淘宝/拼多多不一样，没有传统的"短链"概念：
   *   - vipZfbSchemeUrl：支付宝小程序 scheme（deeplink）
   *   - vipWxUrl：微信小程序页面路径
   *   - 可能还有 vipH5Url / longUrl 等 H5 链接
   *
   * shortUrl 优先用 H5 链接（浏览器里能直接打开），
   * deeplink 用支付宝 scheme，
   * 微信小程序路径放 password 字段里暂存（前端判断 platform=VIP 时可以用）。
   */
  private extractConvertedLink(data: any, goodsId: string, positionId: string): ConvertedLink | null {
    if (!data) return null;

    const shortUrl = data?.shortUrl
      ?? data?.short_url
      ?? data?.clickUrl
      ?? data?.click_url
      ?? data?.promotionUrl
      ?? data?.promotion_url
      ?? data?.vipH5Url
      ?? data?.vip_h5_url
      ?? data?.h5Url
      ?? data?.longUrl
      ?? data?.long_url
      ?? '';

    const deeplink = data?.vipZfbSchemeUrl
      ?? data?.vip_zfb_scheme_url
      ?? data?.schemeUrl
      ?? data?.scheme_url
      ?? data?.deeplink
      ?? shortUrl;

    const password = data?.vipWxUrl
      ?? data?.vip_wx_url
      ?? data?.wxMiniPath
      ?? data?.command
      ?? data?.pwd
      ?? '';

    if (!shortUrl && !deeplink) return null;

    return {
      platform: 'VIP',
      goodsId,
      shortUrl: shortUrl || deeplink, // 至少有一个能用
      deeplink,
      password,
      positionId: positionId || this.opt.pid || '',
    };
  }

  async convertLink(goodsId: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.pid) throw new Error('订单侠唯品会未配置 PID：请在 .env 填 VIP_PID');

    // 优先用商品ID版高佣转链
    try {
      const data = await this.call<any>('/vip/id_privilege', {
        goodsId,
        pid: this.opt.pid,
      });
      this.logger.debug(`唯品会转链(id_privilege)响应: ${JSON.stringify(data).slice(0, 800)}`);

      const result = this.extractConvertedLink(data, goodsId, positionId);
      if (result) return result;
    } catch (e: any) {
      this.logger.warn(`唯品会高佣转链(id_privilege)失败: ${e.message}，回落到 URL 转链`);
    }

    // 兜底：URL 版转链
    const data = await this.call<any>('/vip/url_privilege', {
      url: `https://detail.vip.com/detail-${goodsId}.html`,
      pid: this.opt.pid,
    });
    this.logger.debug(`唯品会转链(url_privilege)响应: ${JSON.stringify(data).slice(0, 800)}`);

    const result = this.extractConvertedLink(data, goodsId, positionId);
    if (result) return result;

    throw new Error('订单侠唯品会转链返回为空');
  }

  // ───────────────────────── 解析（链接/口令） ─────────────────────────

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    // 先尝试本地抠商品 ID
    const idMatch = text.match(/detail\.vip\.com\/detail-([A-Za-z0-9_-]+)/i)
      || text.match(/vip\.com\/detail\/([A-Za-z0-9_-]+)/i)
      || text.match(/goodsId[=:]["']?([A-Za-z0-9_-]+)/i);

    if (idMatch) {
      return this.getGoodsDetail(idMatch[1]);
    }

    // 整条链接拿去解析
    try {
      const data = await this.call<any>('/vip/viplink_check', {
        url: text.trim(),
      });
      const goodsId = data?.goodsId ?? data?.goods_id ?? data?.goodsid ?? '';
      if (!goodsId) return null;
      return this.getGoodsDetail(String(goodsId));
    } catch (e: any) {
      this.logger.debug(`唯品会链接解析失败: ${e.message}`);
      return null;
    }
  }

  // ───────────────────────── 订单 ─────────────────────────

  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    };

    try {
      const data = await this.call<any>('/vip/order_details', {
        page,
        pageSize: 100,
        orderSn: undefined,
        startTime: fmt(start),
        endTime: fmt(end),
      });

      const list = this.extractList(data);
      return list.map((o: any) => this.mapOrder(o));
    } catch (e: any) {
      this.logger.warn(`唯品会订单拉取失败: ${e.message}`);
      return [];
    }
  }

  private mapOrder(o: any): UnifiedOrder {
    const payAmount = Number(o.orderAmount ?? o.payAmount ?? o.pay_amount ?? o.totalAmount ?? 0);
    const commissionRate = Number(o.commissionRate ?? o.commission_rate ?? 0) / 100;
    const estCommission = Number(o.commission ?? o.estimateCommission ?? o.est_commission ?? 0);
    const settleCommission = Number(o.settleCommission ?? o.settle_commission ?? 0);

    // 唯品会订单状态（根据文档 + 常识猜测，联调时修正）：
    //   status: 0=不合格, 1=待付款, 2=已付款, 3=已收货/已结算, 4=已退款
    // 统一状态：1=已付款 2=已收货 3=已结算 4=已失效
    let status = 1;
    const rawStatus = String(o.status ?? o.orderStatus ?? o.order_status ?? '');
    if (rawStatus === '3' || rawStatus === '已结算' || rawStatus.includes('结算')) {
      status = 3;
    } else if (rawStatus === '2' || rawStatus.includes('付款') || rawStatus.includes('下单')) {
      status = 1;
    } else if (rawStatus === '4' || rawStatus.includes('退款') || rawStatus.includes('取消') || rawStatus === '0') {
      status = 4;
    }

    const positionId = String(o.pid ?? o.positionId ?? o.position_id ?? o.promotionId ?? '');

    const parseDate = (s: string | number | undefined) => {
      if (!s) return undefined;
      // 可能是时间戳，也可能是日期字符串
      const num = Number(s);
      if (!isNaN(num) && num > 1e12) return new Date(num);
      const d = new Date(s);
      return isNaN(d.getTime()) ? undefined : d;
    };

    return {
      platform: 'VIP',
      platformOrderNo: String(o.orderSn ?? o.order_sn ?? o.orderId ?? o.order_id ?? o.id ?? ''),
      subOrderNo: String(o.id ?? o.subOrderId ?? o.sub_order_id ?? o.itemId ?? ''),
      positionId,
      goodsId: String(o.goodsId ?? o.goods_id ?? o.goodId ?? ''),
      goodsTitle: o.goodsName ?? o.goods_name ?? o.title ?? '',
      goodsImg: o.goodsThumb ?? o.goods_thumb ?? o.goodsMainPicture ?? o.image ?? '',
      payAmount: round2(payAmount),
      commissionRate,
      estCommission: round2(estCommission),
      settleCommission: status === 3 ? round2(settleCommission || estCommission) : 0,
      status,
      orderTime: parseDate(o.orderTime ?? o.createTime ?? o.create_time ?? o.order_time) ?? new Date(),
      settleTime: parseDate(o.settleTime ?? o.settle_time ?? o.finishTime),
      raw: o,
    };
  }
}
