import { Logger } from '@nestjs/common';
import {
  ConvertedLink, CpsProvider, GoodsPage, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

export interface DingdanxiaOptions {
  apiKey: string;
  /** 淘宝 PID（mm_xxx_xxx_xxx），转链必填 */
  pid?: string;
  /** 渠道管理ID（relation_id），订单侠转链必填 */
  relationId?: string;
  baseUrl?: string;
}

const DEFAULT_BASE = 'http://api.tbk.dingdanxia.com';

/** 请求超时时间（毫秒）。订单侠接口在海外访问可能较慢，给 30 秒 */
const FETCH_TIMEOUT_MS = 30000;

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * 订单侠（dingdanxia）淘宝联盟聚合渠道。
 *
 * 所有接口都是 POST，apikey 放 body 里。
 *
 * 文档：https://www.dingdanxia.com/apidocument
 *   - 搜索：/tbk/material_recommend 或 /tbk/super_search_material
 *   - 详情：从搜索结果里取，或用 /tbk/item_detail（待确认）
 *   - 转链：/tbk/general_convert（万能转链）
 *   - 订单：/tbk/order_details
 *   - 淘口令解析：/tbk/uland_query 或 /tbk/tkl_query
 */
export class DingdanxiaProvider implements CpsProvider {
  readonly platform = 'TB';
  private readonly logger = new Logger(DingdanxiaProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly opt: DingdanxiaOptions) {
    this.baseUrl = opt.baseUrl || DEFAULT_BASE;
  }

  // ───────────────────────── 网关 ─────────────────────────

  private async call<T>(path: string, body: Record<string, any>): Promise<T> {
    if (!this.opt.apiKey) {
      throw new Error('订单侠未配置：请在 .env 填 DDX_API_KEY');
    }
    const url = new URL(path, this.baseUrl);
    const payload = { ...body, apikey: this.opt.apiKey };
    // 清理空值
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined || payload[k] === null || payload[k] === '') {
        delete payload[k];
      }
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`订单侠 ${path} HTTP ${res.status}`);
    const json: any = await res.json();
    // 订单侠 code 约定：200 成功，其他失败（有些接口用 0，两种都兼容）
    if (json.code !== undefined && json.code !== 200 && json.code !== 0) {
      throw new Error(`订单侠 ${path}: ${json.code} ${json.msg || json.message || ''}`);
    }
    return (json.data ?? json.result ?? json) as T;
  }

  // ───────────────────────── 字段映射 ─────────────────────────

  /**
   * 订单侠返回的商品结构分两种：
   * 1. 扁平结构（搜索接口）：title、pict_url、zk_final_price 都在顶层
   * 2. 嵌套结构（物料精选接口）：item_basic_info、price_promotion_info、publish_info 分开
   *    - 佣金在 publish_info.income_rate（百分比字符串，如 "9.0"）
   *    - income_info 是空数组，别用它
   * 这里两种都兼容，从所有可能的位置找。
   */
  private mapGoods(raw: any): UnifiedGoods {
    const basic = raw.item_basic_info ?? raw;
    const priceInfo = raw.price_promotion_info ?? raw;
    const publishInfo = raw.publish_info ?? raw;
    const couponInfo = raw.coupon_info ?? raw;

    // 价格：优先从 price_promotion_info 里取
    const price = Number(
      priceInfo.zk_final_price
        ?? raw.zk_final_price
        ?? basic.zk_final_price
        ?? priceInfo.final_price
        ?? raw.final_price
        ?? basic.original_price
        ?? basic.price
        ?? 0,
    );

    // 优惠券金额
    const couponAmount = Number(
      raw.coupon_amount
        ?? couponInfo.coupon_amount
        ?? raw.coupon_price
        ?? raw.coupon
        ?? couponInfo.coupon_price
        ?? 0,
    );

    // 券后价：有 final_price 就用，没有就原价减券
    let couponPrice = Number(
      priceInfo.final_promotion_price
        ?? raw.final_price
        ?? raw.coupon_price_after
        ?? couponInfo.final_price
        ?? 0,
    );
    if (!couponPrice) couponPrice = Math.max(price - couponAmount, 0);

    // 佣金比例：
    // - publish_info.income_rate 是百分比（字符串，如 "9.0" = 9%）
    // - publish_info.income_info.commission_rate 是千分比（如 "900" = 9%）
    //   注意：income_info 有时候是空数组（物料精选接口），要判断一下
    const incomeInfoObj = publishInfo.income_info && !Array.isArray(publishInfo.income_info)
      ? publishInfo.income_info
      : null;

    let rate = 0;
    if (publishInfo.income_rate) {
      rate = Number(publishInfo.income_rate) / 100;
    } else if (incomeInfoObj?.commission_rate) {
      rate = Number(incomeInfoObj.commission_rate) / 1000; // 千分比
    } else if (raw.commission_rate) {
      rate = Number(raw.commission_rate) / 100;
    }

    // 佣金金额：有就直接用，没有自己算
    const commissionRaw = Number(
      incomeInfoObj?.commission_amount
        ?? publishInfo.commission_amount
        ?? raw.commission
        ?? raw.promotion_amount
        ?? raw.tk_commission
        ?? 0,
    );
    const commission = commissionRaw > 0 ? commissionRaw : round2(couponPrice * rate);

    // 商品 ID：顶层 item_id 优先（物料精选返回的是加密字符串）
    const goodsId = String(
      raw.item_id
        ?? basic.item_id
        ?? raw.goods_id
        ?? basic.goods_id
        ?? basic.id
        ?? basic.num_iid
        ?? '',
    );

    // 图片地址：淘宝的图是 //img.alicdn.com/... 这种相对协议，补 https:
    const rawImg = basic.pict_url
      ?? basic.goods_thumbnail_url
      ?? basic.main_pic
      ?? basic.img
      ?? raw.pict_url
      ?? raw.main_image
      ?? '';
    const image = rawImg && rawImg.startsWith('//') ? `https:${rawImg}` : rawImg;

    // 多张图：small_images 可能是 { string: [...] } 结构，也可能是数组
    const smallImgs = basic.small_images ?? raw.small_images ?? null;
    let images: string[] = [];
    if (smallImgs) {
      if (Array.isArray(smallImgs)) {
        images = smallImgs;
      } else if (Array.isArray(smallImgs.string)) {
        images = smallImgs.string;
      } else if (typeof smallImgs === 'string') {
        images = [smallImgs];
      }
    }
    // 主图也加进去（如果不在列表里）
    if (image && !images.includes(image)) images.unshift(image);
    // 相对协议补 https:
    images = images.map((img) => (img && img.startsWith('//') ? `https:${img}` : img));

    return {
      platform: 'TB',
      goodsId,
      title: basic.title ?? basic.goods_name ?? basic.name ?? raw.title ?? '',
      image,
      images,
      shopName: basic.shop_title ?? basic.mall_name ?? basic.shop_name ?? basic.nick ?? raw.shop_title ?? '',
      price: round2(price),
      couponPrice: round2(couponPrice),
      couponAmount: round2(couponAmount),
      commissionRate: rate,
      commission: round2(commission),
      salesVolume: Number(
        basic.volume
          ?? basic.sales_tip
          ?? basic.month_sales
          ?? basic.sell_num
          ?? raw.volume
          ?? raw.sales
          ?? 0,
      ),
    };
  }

  // ───────────────────────── 工具方法 ─────────────────────────

  /**
   * 从接口返回的 data 里提取商品列表数组。
   * 订单侠不同接口返回结构不太一致，这里做多路径兜底。
   */
  private extractList(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.list)) return data.list;
    if (Array.isArray(data.result_list)) return data.result_list;
    if (data.result_list && Array.isArray(data.result_list.map_data)) return data.result_list.map_data;
    if (Array.isArray(data.items)) return data.items;
    return [];
  }

  // ───────────────────────── CpsProvider ─────────────────────────

  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    return (await this.searchGoodsPage(p)).list;
  }

  /**
   * 商品搜索。
   * - 有关键词：走超级搜索 super_search_material
   * - 无关键词：走物料精选 material_recommend + material_id
   */
  async searchGoodsPage(p: SearchParams): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(Math.max(p.pageSize ?? 20, 1), 100);
    const sortMap: Record<string, string> = {
      sales: 'total_sales_des',
      commission: 'tk_rate_des',
      price: 'price_des',
    };

    if (p.keyword) {
      // 有搜索词：超级搜索（page_size 最大 20）
      const searchPageSize = Math.min(pageSize, 20);
      const params: Record<string, any> = {
        q: p.keyword,
        page_no: page,
        page_size: searchPageSize,
        sort: sortMap[p.sort ?? ''] ?? 'tk_total_sales_des',
      };
      const data = await this.call<any>('/tbk/super_search_material', params);
      const list = this.extractList(data).map((r: any) => this.mapGoods(r));
      const total = Number(data?.total_count ?? data?.total_results ?? data?.total ?? 0);
      return {
        list,
        total,
        page,
        hasMore: list.length === searchPageSize,
      };
    }

    // 无搜索词：物料精选（不同 channel 对应不同 material_id）
    // 物料ID来自淘宝联盟物料市场，会定期更新，需要时调整
    // 注意：84xxx 段已弃用，更新为 96xxx 段
    const materialMap: Record<string, number> = {
      hot: 13366,     // 综合（热销）
      earn: 96185,    // 高佣
      cheap: 13368,   // 家居家装
      coupon: 13366,  // 默认综合
      pick: 13366,
      all: 13366,
    };
    const materialId = materialMap[p.sort ?? ''] ?? materialMap.coupon;
    const data = await this.call<any>('/tbk/material_recommend', {
      material_id: materialId,
      page_no: page,
      page_size: pageSize,
    });
    const rawList = this.extractList(data);
    const list = rawList.map((r: any) => this.mapGoods(r));
    return {
      list,
      total: list.length,
      page,
      hasMore: list.length === pageSize,
    };
  }

  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    return (await this.recommendGoodsPage(p)).list;
  }

  /**
   * 榜单推荐：走物料精选的不同 material_id。
   * 物料ID来自淘宝联盟物料市场，会定期更新。
   */
  async recommendGoodsPage(p: RecommendParams = {}): Promise<GoodsPage> {
    const materialMap: Record<string, number> = {
      hot: 13366,     // 综合（热销）
      earn: 96185,    // 高佣
      cheap: 13368,   // 家居家装
      coupon: 13366,  // 默认综合
      pick: 13366,
      all: 13366,
    };
    const materialId = materialMap[p.channel ?? 'hot'] ?? 13366;
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(Math.max(p.pageSize ?? 20, 1), 100);

    const data = await this.call<any>('/tbk/material_recommend', {
      material_id: materialId,
      page_no: page,
      page_size: pageSize,
    });
    const list = this.extractList(data).map((r: any) => this.mapGoods(r));
    return {
      list,
      total: list.length,
      page,
      hasMore: list.length === pageSize,
    };
  }

  async getGoodsDetail(goodsId: string): Promise<UnifiedGoods | null> {
    if (!goodsId) return null;
    // 优先用高佣转链接口（id_privilege），它返回的详情最完整
    // 不需要 relation_id 也能调用（没有的话就只传 pid）
    try {
      const params: Record<string, any> = { id: goodsId };
      if (this.opt.pid) params.pid = this.opt.pid;
      if (this.opt.relationId) params.relation_id = this.opt.relationId;
      const data = await this.call<any>('/tbk/id_privilege', params);
      if (data && (data.item_id || data.itemInfo)) {
        return this.mapPrivilegeDetail(data);
      }
    } catch (e: any) {
      this.logger.debug(`淘宝详情(id_privilege)失败: ${e.message}`);
    }

    // 兜底：用超级搜索接口，把 item_id 当搜索词传进去
    const data = await this.call<any>('/tbk/super_search_material', {
      q: goodsId,
      page_no: 1,
      page_size: 5,
    });
    const list = this.extractList(data);
    const hit = list.find((r: any) => String(r.item_id ?? r.goods_id ?? r.id) === goodsId)
      ?? list[0];
    return hit ? this.mapGoods(hit) : null;
  }

  /**
   * 把 id_privilege 接口返回的详情数据映射成统一格式。
   * 这个接口返回的字段跟物料精选不一样：
   * - 顶层有 item_id、max_commission_rate、coupon、item_url 等
   * - 商品详情在 itemInfo 里（title、pict_url、volume、zk_final_price、qh_final_price 等）
   */
  private mapPrivilegeDetail(data: any): UnifiedGoods {
    const info = data?.itemInfo ?? {};
    const price = Number(info.zk_final_price ?? data.zk_final_price ?? info.reserve_price ?? 0);
    const couponAmount = Number(data.coupon ?? data.coupon_amount ?? 0);
    const couponPrice = Number(info.qh_final_price ?? data.qh_final_price ?? 0)
      || Math.max(price - couponAmount, 0);
    const rate = Number(data.max_commission_rate ?? info.commission_rate ?? 0) / 100;
    const commission = Number(info.qh_final_commission ?? data.commission_amount ?? 0)
      || round2(couponPrice * rate);

    const rawImg = info.pict_url ?? data.pict_url ?? '';
    const image = rawImg && rawImg.startsWith('//') ? `https:${rawImg}` : rawImg;

    // 多张图
    const smallImgs = info.small_images ?? data.small_images ?? null;
    let images: string[] = [];
    if (smallImgs) {
      if (Array.isArray(smallImgs)) {
        images = smallImgs;
      } else if (Array.isArray(smallImgs.string)) {
        images = smallImgs.string;
      } else if (typeof smallImgs === 'string') {
        images = [smallImgs];
      }
    }
    if (image && !images.includes(image)) images.unshift(image);
    images = images.map((img) => (img && img.startsWith('//') ? `https:${img}` : img));

    return {
      platform: 'TB',
      goodsId: String(data.item_id ?? info.item_id ?? ''),
      title: info.title ?? data.title ?? '',
      image,
      images,
      shopName: info.nick ?? info.shop_title ?? data.shop_title ?? '',
      price: round2(price),
      couponPrice: round2(couponPrice),
      couponAmount: round2(couponAmount),
      commissionRate: rate,
      commission: round2(commission),
      salesVolume: Number(info.volume ?? data.volume ?? 0),
    };
  }

  /**
   * 万能转链。
   * 优先用 id_privilege（高佣转链，返回详情最全），需要 relation_id；
   * 没有 relation_id 的话用 general_convert（万能转链），只需要 pid。
   */
  async convertLink(goodsId: string, positionId: string): Promise<ConvertedLink> {
    // 方案1：高佣转链 id_privilege（有 relation_id 用 relation_id，没有也试试只传 pid）
    try {
      const params: Record<string, any> = {
        id: goodsId,
        pid: this.opt.pid || undefined,
        external_id: positionId,
      };
      if (this.opt.relationId) params.relation_id = this.opt.relationId;
      const data = await this.call<any>('/tbk/id_privilege', params);
      const shortUrl = data?.coupon_click_url ?? data?.item_url ?? '';
      const tpwd = data?.coupon_tpwd ?? data?.item_tpwd ?? '';
      if (shortUrl || tpwd) {
        this.logger.log(`淘宝转链成功: id_privilege, goodsId=${goodsId}`);
        return {
          platform: 'TB',
          goodsId: String(data?.item_id ?? goodsId),
          shortUrl: shortUrl || tpwd,
          deeplink: shortUrl,
          password: tpwd,
          positionId,
        };
      }
    } catch (e: any) {
      this.logger.warn(`淘宝高佣转链(id_privilege)失败: ${e.message}，回落到万能转链`);
    }

    // 方案2：万能转链 wn_convert（content 传商品详情链接，让接口自己解析转链）
    if (!this.opt.pid) throw new Error('订单侠未配置淘宝 PID：请在 .env 填 TB_PID');

    // wn_convert 的 content 需要是淘口令/链接，纯商品ID会被当成口令解析报错。
    // 传一个淘宝商品详情页链接，让接口自己去识别转链。
    const content = `https://item.taobao.com/item.htm?id=${goodsId}`;
    const reqBody = {
      content,
      pid: this.opt.pid,
      relation_id: this.opt.relationId || undefined,
      external_id: positionId,
    };
    this.logger.log(`淘宝万能转链请求: content=${content}, pid=${this.opt.pid}`);
    const data = await this.call<any>('/tbk/wn_convert', reqBody);
    this.logger.log(`淘宝万能转链响应: ${JSON.stringify(data).slice(0, 500)}`);

    const shortUrl = data?.coupon_short_url
      ?? data?.cps_short_url
      ?? data?.short_url
      ?? data?.click_url
      ?? data?.coupon_click_url
      ?? '';
    const tpwd = data?.tpwd ?? data?.password ?? data?.model ?? data?.tbk_pwd ?? '';
    if (!shortUrl && !tpwd) throw new Error('订单侠转链返回为空');

    this.logger.log(`淘宝转链成功: wn_convert, goodsId=${goodsId}`);
    return {
      platform: 'TB',
      goodsId: String(data?.item_id ?? goodsId),
      shortUrl: shortUrl || tpwd,
      deeplink: data?.deeplink ?? data?.schema ?? shortUrl,
      password: tpwd,
      positionId,
    };
  }

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    // 先用二合一解析接口（淘口令/链接都能解）
    try {
      const data = await this.call<any>('/tbk/uland_query', {
        content: text,
      });
      const itemId = data?.item_id ?? data?.goods_id ?? data?.num_iid ?? data?.id;
      if (itemId) return this.getGoodsDetail(String(itemId));
    } catch {
      // 解析失败走本地正则兜底
    }

    // 本地兜底：从文本里提取商品 ID（淘宝商品 id 是 11 位左右的数字）
    const m = text.match(/\b(\d{10,12})\b/);
    if (m) return this.getGoodsDetail(m[1]);
    return null;
  }

  /**
   * 订单查询。
   * 时间格式：yyyy-MM-dd HH:mm:ss
   * 分页：第一页不用 position_index，后面翻页用上一页返回的 position_index
   * query_type：1=创建时间 2=付款时间 3=结算时间 4=更新时间
   */
  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    const fmt = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', ' ').slice(0, 19);

    // 订单侠的分页比较特殊：用 position_index，不是普通的 page_no
    // 第一页不传，后面翻页要带上一页返回的最后一条的 position_index
    // 这里先简化：只拉第一页，或者用 page_no（有些版本支持）
    const params: Record<string, any> = {
      start_time: fmt(start),
      end_time: fmt(end),
      query_type: 4, // 4=按更新时间（增量拉取用）
      page_size: 100,
    };
    if (page > 1) {
      params.page_no = page;
    }

    const data = await this.call<any>('/tbk/order_details', params);
    const list = data?.list ?? data?.results ?? data?.data ?? data ?? [];
    return (Array.isArray(list) ? list : []).map((o: any) => this.mapOrder(o));
  }

  /**
   * 淘宝订单状态（tk_status）：
   *   1 - 已付款
   *   3 - 结算成功
   *   12 - 已收货/确认收货
   *   13 - 维权成功
   *   14 - 结算失败
   */
  private mapOrder(o: any): UnifiedOrder {
    const tkStatus = Number(o.tk_status ?? o.order_status ?? o.status ?? 0);

    // 统一状态：1=已付款 2=已收货 3=已结算 4=已失效
    let status: number;
    switch (tkStatus) {
      case 1: status = 1; break;
      case 12: status = 2; break;
      case 3: status = 3; break;
      case 13: case 14: case 4: status = 4; break;
      default: status = tkStatus >= 3 ? 3 : tkStatus === 12 ? 2 : tkStatus === 1 ? 1 : 4;
    }

    // 订单归属：external_id / special_id / custom_parameters 里的自定义参数
    let positionId = '';
    try {
      const custom = o.custom_parameters ? JSON.parse(o.custom_parameters) : {};
      positionId = custom.uid ?? custom.positionId ?? custom.external_id ?? '';
    } catch { /* 解析失败就忽略 */ }
    if (!positionId) positionId = String(o.external_id ?? o.special_id ?? o.adzone_id ?? '');

    const payAmount = Number(o.alipay_total_price ?? o.pay_price ?? o.item_price ?? 0);
    const commissionRate = Number(o.pub_share_rate ?? o.commission_rate ?? o.tk_rate ?? 0) / 100;
    const estCommission = Number(o.pub_share_pre_fee ?? o.commission_pre ?? o.income_pre ?? 0);
    const settleCommission = Number(o.pub_share_fee ?? o.settle_amount ?? o.income ?? 0);

    const parseDate = (v: any) => {
      if (!v) return undefined;
      if (typeof v === 'number') return new Date(v * 1000);
      return new Date(v);
    };

    return {
      platform: 'TB',
      platformOrderNo: String(o.trade_id ?? o.trade_parent_id ?? o.order_sn ?? o.tb_trade_id ?? ''),
      subOrderNo: String(o.trade_id ?? o.item_id ?? o.sub_trade_id ?? ''),
      positionId,
      goodsId: String(o.item_id ?? o.goods_id ?? o.num_iid ?? ''),
      goodsTitle: o.item_title ?? o.goods_name ?? o.title ?? '',
      goodsImg: o.item_img ?? o.goods_img ?? o.pict_url ?? '',
      payAmount: round2(payAmount),
      commissionRate,
      estCommission: round2(estCommission),
      settleCommission: status === 3 ? round2(settleCommission || estCommission) : 0,
      status,
      orderTime: parseDate(o.create_time) ?? new Date(),
      settleTime: parseDate(o.settle_time ?? o.earning_time),
      raw: o,
    };
  }
}

// ───────────────────────── 京东（订单侠聚合） ─────────────────────────

export interface DingdanxiaJdOptions {
  apiKey: string;
  /** 京东联盟 ID（UnionId），转链必填 */
  unionId?: string;
  /** 默认推广位 ID */
  positionId?: string;
  /** 京东专线域名，搜索/详情等走这个 */
  baseUrl?: string;
  /** 通用域名，部分接口（如转链）专线上没有，走通用域名 */
  commonBaseUrl?: string;
}

/**
 * 订单侠京东联盟聚合渠道。
 *
 * 用同一个 apikey，接口前缀是 /jd/...
 * 文档：https://www.dingdanxia.com/apidoc/jd
 */
export class DingdanxiaJdProvider implements CpsProvider {
  readonly platform = 'JD';
  private readonly logger = new Logger(DingdanxiaJdProvider.name);
  private readonly baseUrl: string;
  private readonly commonBaseUrl: string;

  constructor(private readonly opt: DingdanxiaJdOptions) {
    this.baseUrl = opt.baseUrl || DEFAULT_BASE;
    // 通用域名：如果没单独配置，就用默认的官方通用域名
    // （不要用京东专线，部分接口如 url_privilege 专线上没有）
    this.commonBaseUrl = opt.commonBaseUrl || DEFAULT_BASE;
  }

  private async call<T>(path: string, body: Record<string, any>, useCommonBase = false): Promise<T> {
    const json = await this.callRaw(path, body, useCommonBase);
    return (json.data ?? json.result ?? json) as T;
  }

  /** 返回完整响应（含 code/msg/total_results 等外层字段），分页时需要读 total */
  private async callRaw(path: string, body: Record<string, any>, useCommonBase = false): Promise<any> {
    if (!this.opt.apiKey) {
      throw new Error('订单侠未配置：请在 .env 填 DDX_API_KEY');
    }
    const baseUrl = useCommonBase ? this.commonBaseUrl : this.baseUrl;
    const url = new URL(path, baseUrl);
    const payload = { ...body, apikey: this.opt.apiKey };
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined || payload[k] === null || payload[k] === '') {
        delete payload[k];
      }
    }
    this.logger.debug(`京东请求: ${url.toString()}`);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload).toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (e: any) {
      this.logger.error(`京东请求失败: ${url.toString()}, error: ${e.message}, cause: ${e.cause?.message ?? e.cause ?? ''}`);
      throw e;
    }
    if (!res.ok) throw new Error(`订单侠京东 ${path} HTTP ${res.status}`);
    const json: any = await res.json();
    if (json.code !== undefined && json.code !== 200 && json.code !== 0) {
      this.logger.warn(`京东接口 ${path} 错误: code=${json.code}, msg=${json.msg || json.message || ''}, body=${JSON.stringify(json).slice(0, 500)}`);
      throw new Error(`订单侠京东 ${path}: ${json.code} ${json.msg || json.message || ''}`);
    }
    return json;
  }

  // ───────────────────────── 字段映射 ─────────────────────────

  private mapGoods(raw: any): UnifiedGoods {
    // 订单侠京东两个主要接口字段不同，这里都兼容：
    // 1. query_jingfen_goods（搜索）：嵌套结构 imageInfo/priceInfo/commissionInfo/couponInfo/shopInfo
    // 2. query_goods_rank（榜单）：扁平 + 部分嵌套 imageUrl/imgList/purchasePriceInfo/couponList

    // 商品ID：优先用 skuId（数字，可直接拼 item.jd.com 链接），
    // 没有的话用 itemId（加密的联盟商品ID，转链时需特殊处理）
    const skuId = String(
      raw.skuId
      ?? raw.sku_id
      ?? raw.id
      ?? raw.itemId
      ?? raw.item_id
      ?? raw.goodsId
      ?? raw.goods_id
      ?? raw.wareId
      ?? raw.ware_id
      ?? raw.productId
      ?? ''
    );
    const title = raw.skuName ?? raw.sku_name ?? raw.name ?? raw.title ?? '';

    // 图片：榜单用 imageUrl + imgList(字符串数组)；搜索用 imageInfo.imageList(对象数组)
    let images: string[] = [];
    const imgList = raw.imgList ?? raw.imageInfo?.imageList ?? raw.images ?? [];
    if (Array.isArray(imgList)) {
      images = imgList.map((i: any) => typeof i === 'string' ? i : (i.url ?? i.img ?? i.pic ?? ''));
    }
    const image = raw.imageUrl
      ?? images[0]
      ?? raw.imageInfo?.whiteImage
      ?? raw.img
      ?? raw.pic
      ?? '';
    if (image && !images.includes(image)) images.unshift(image);
    images = images.filter(Boolean);

    const shopName = raw.shopInfo?.shopName ?? raw.shop_name ?? raw.shop ?? '';

    // 价格：
    //   搜索：priceInfo.price=原价, priceInfo.lowestCouponPrice=券后价
    //   榜单：wlprice=基准价, purchasePriceInfo.purchasePrice=到手价
    const priceInfo = raw.priceInfo ?? raw.price_info ?? {};
    const purchaseInfo = raw.purchasePriceInfo ?? raw.purchase_price_info ?? {};
    const price = Number(priceInfo.price ?? priceInfo.originalPrice ?? raw.wlprice ?? raw.price ?? 0);
    const couponPriceRaw = Number(
      priceInfo.lowestCouponPrice
      ?? priceInfo.finalPrice
      ?? purchaseInfo.purchasePrice
      ?? raw.couponPrice
      ?? 0
    );

    // 优惠券：
    //   搜索：couponInfo.couponList[].discount
    //   榜单：couponList[].discount
    let couponAmount = 0;
    const couponList = raw.couponList
      ?? raw.couponInfo?.couponList
      ?? raw.coupon_list
      ?? [];
    if (Array.isArray(couponList) && couponList.length) {
      const best = couponList.find((c: any) => c.isBest === 1) ?? couponList[0];
      couponAmount = Number(best.discount ?? best.coupon_price ?? best.amount ?? 0);
    }
    const couponPrice = couponPriceRaw || Math.max(price - couponAmount, 0);

    // 佣金：
    //   搜索：commissionInfo.commission / commissionShare
    //   榜单：commission / commissionShare（顶层）
    const commissionInfo = raw.commissionInfo ?? raw.commission_info ?? {};
    const commission = Number(
      commissionInfo.commission
      ?? commissionInfo.fee
      ?? raw.commission
      ?? 0
    );
    const commissionRate = Number(
      commissionInfo.commissionShare
      ?? commissionInfo.rate
      ?? raw.commissionShare
      ?? raw.commissionRate
      ?? 0
    ) / 100;

    // 销量
    const salesVolume = Number(raw.inOrderCount30Days ?? raw.comments ?? raw.sales ?? raw.salesVolume ?? 0);

    return {
      platform: 'JD',
      goodsId: skuId,
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
    if (Array.isArray(data.data)) return Array.isArray(data.data) ? data.data : this.extractList(data.data);
    if (data.goodsList && Array.isArray(data.goodsList)) return data.goodsList;
    if (data.skuList && Array.isArray(data.skuList)) return data.skuList;
    if (data.rows && Array.isArray(data.rows)) return data.rows;
    return [];
  }

  // ───────────────────────── 搜索 ─────────────────────────

  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    const r = await this.searchGoodsPage(p);
    return r.list;
  }

  async searchGoodsPage(p: SearchParams): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(p.pageSize ?? 30, 50);
    const keyword = p.keyword ?? '';

    const sortMap: Record<string, string> = {
      sales: 'sale',
      commission: 'fee',
      price: 'price',
    };
    const sortName = sortMap[p.sort || ''] || '';

    const json = await this.callRaw('/jd/query_jingfen_goods', {
      keyword,
      pageIndex: page,
      pageSize,
      eliteId: 22, // 频道ID，必填，22=实时热销榜（商品最全）
      sortName: sortName || undefined,
      sort: p.sort === 'price' ? 'asc' : 'desc',
    });

    const rawList = this.extractList(json.data ?? json);
    if (rawList.length) {
      this.logger.debug(`京东搜索返回第一条原始数据: ${JSON.stringify(rawList[0]).slice(0, 800)}`);
    }
    const list = rawList.map((r: any) => this.mapGoods(r));
    const total = Number(json.total_results ?? json.totalCount ?? json.total ?? list.length);
    const hasMore = list.length >= pageSize;

    return { list, total, page, hasMore };
  }

  // ───────────────────────── 榜单 / 推荐 ─────────────────────────

  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    const r = await this.recommendGoodsPage(p);
    return r.list;
  }

  async recommendGoodsPage(p: RecommendParams = {}): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(p.pageSize ?? 30, 50);

    // 榜单 ID 映射：
    // 200000=全部 200001=食品酒水 200002=家庭清洁 200003=个护美妆
    // 200004=医药保健 200005=生鲜 200006=数码家电 200007=家居日用 200008=时尚生活
    const rankMap: Record<string, number> = {
      all: 200000,
      earn: 200000,    // 收益榜用全品类
      hot: 200000,     // 热销榜也用全品类（接口本身就是热销榜）
      cheap: 200000,   // 便宜的也从全品类里找
    };
    const rankId = rankMap[p.channel ?? 'hot'] ?? 200000;

    const json = await this.callRaw('/jd/query_goods_rank', {
      rankId,
      sortType: 1, // 排序类型 1=小时 2=24小时 3=3日 4=7日
      pageIndex: page,
      pageSize,
    });

    const list = this.extractList(json.data ?? json).map((r: any) => this.mapGoods(r));
    const total = Number(json.total_results ?? json.totalCount ?? json.total ?? list.length);
    const hasMore = list.length >= pageSize;

    return { list, total, page, hasMore };
  }

  // ───────────────────────── 详情 ─────────────────────────

  async getGoodsDetail(skuId: string): Promise<UnifiedGoods | null> {
    if (!skuId) return null;
    try {
      const data = await this.call<any>('/jd/item_detail', { skuIds: skuId });
      const list = this.extractList(data);
      if (!list.length) return null;
      return this.mapGoods(list[0]);
    } catch (e: any) {
      this.logger.debug(`京东详情(item_detail)失败: ${e.message}`);
    }

    // 兜底：搜索接口按 skuId 搜
    try {
      const data = await this.call<any>('/jd/query_jingfen_goods', {
        keyword: skuId,
        pageIndex: 1,
        pageSize: 5,
      });
      const list = this.extractList(data);
      const hit = list.find((r: any) => {
        const rid = String(r.skuId ?? r.itemId ?? r.id ?? '');
        return rid === skuId;
      }) ?? list[0];
      return hit ? this.mapGoods(hit) : null;
    } catch {
      return null;
    }
  }

  // ───────────────────────── 转链 ─────────────────────────

  async convertLink(goodsId: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.unionId) throw new Error('订单侠京东未配置 UnionId：请在 .env 填 JD_UNION_ID');

    // url_privilege 接口支持多种 materialId 格式：
    // - 京东商品链接 (item.jd.com/xxx.html)
    // - 联盟商品ID (itemId，加密字符串) → 要拼成京粉详情页链接
    // - 联盟商品链接 (jingfen.jd.com/detail/{itemId}.html)
    // 纯数字就拼京东商品链接，否则拼京粉详情链接
    // 注意：不要加 https:// 前缀，订单侠文档示例是不带协议的
    const materialId = /^\d+$/.test(goodsId)
      ? `item.jd.com/${goodsId}.html`
      : `jingfen.jd.com/detail/${goodsId}.html`;

    const reqBody: Record<string, any> = {
      materialId,
      unionId: this.opt.unionId,
      // 只传必填参数，其他的不传避免干扰
    };
    this.logger.debug(`京东转链请求: goodsId=${goodsId}, materialId=${materialId}, baseUrl=${this.commonBaseUrl}`);
    const data = await this.call<any>('/jd/url_privilege', reqBody, true);
    this.logger.debug(`京东转链响应: ${JSON.stringify(data).slice(0, 800)}`);

    // 各种可能的返回字段
    const shortUrl = data?.clickURL
      ?? data?.click_url
      ?? data?.shortUrl
      ?? data?.short_url
      ?? data?.couponClickUrl
      ?? data?.coupon_click_url
      ?? '';
    const deeplink = data?.longURL ?? data?.long_url ?? shortUrl;
    const password = data?.command ?? data?.pwd ?? data?.password ?? '';

    if (!shortUrl) throw new Error('订单侠京东转链返回为空');

    return {
      platform: 'JD',
      goodsId,
      shortUrl,
      deeplink,
      password,
      positionId,
    };
  }

  // ───────────────────────── 解析（淘口令/链接） ─────────────────────────

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    // 京东商品 ID 一般是 7-12 位数字
    const m = text.match(/\b(\d{7,12})\b/);
    if (m) return this.getGoodsDetail(m[1]);
    // 京粉链接里的 itemId：jingfen.jd.com/detail/{itemId}.html
    const m2 = text.match(/jingfen\.jd\.com\/detail\/([a-zA-Z0-9_-]+)\.html/);
    if (m2) return this.getGoodsDetail(m2[1]);
    // 3.cn 短链
    if (/3\.cn\//.test(text)) {
      // 短链解析不了，返回 null 让上层走通用逻辑
      return null;
    }
    return null;
  }

  // ───────────────────────── 订单 ─────────────────────────

  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    const fmt = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', ' ').slice(0, 19);

    const data = await this.call<any>('/jd/order_details2', {
      pageIndex: page,
      pageSize: 100,
      startTime: fmt(start),
      endTime: fmt(end),
      type: 1, // 1=下单时间 2=更新时间
    });

    const list = this.extractList(data);
    return list.map((o: any) => this.mapOrder(o));
  }

  private mapOrder(o: any): UnifiedOrder {
    const payAmount = Number(o.actualPayPrice ?? o.pay_price ?? o.order_price ?? o.factPrice ?? 0);
    const commissionRate = Number(o.feeRate ?? o.commission_rate ?? 0) / 100;
    const estCommission = Number(o.estimateFee ?? o.estimate_fee ?? o.commission ?? o.fee ?? 0);
    const settleCommission = Number(o.settleFee ?? o.settle_fee ?? 0);

    // 京东订单状态：1=完成 2=付款确认 3=取消 4=申请退款 5=退款成功 6=已结算
    let status = 1;
    const rawStatus = String(o.validCode ?? o.status ?? o.order_status ?? '');
    if (rawStatus === '17' || rawStatus === '已结算' || rawStatus.includes('结算')) {
      status = 3;
    } else if (rawStatus === '2' || rawStatus.includes('付款')) {
      status = 1;
    } else if (rawStatus === '3' || rawStatus === '4' || rawStatus === '5' || rawStatus.includes('取消') || rawStatus.includes('退款')) {
      status = 4;
    }

    const positionId = String(o.positionId ?? o.position_id ?? o.subUnionId ?? o.unionId ?? '');

    const parseDate = (s: string | number | undefined) => {
      if (!s) return undefined;
      const d = new Date(s);
      return isNaN(d.getTime()) ? undefined : d;
    };

    return {
      platform: 'JD',
      platformOrderNo: String(o.parentId ?? o.order_id ?? o.orderId ?? o.id ?? ''),
      subOrderNo: String(o.id ?? o.sku_id ?? o.skuId ?? o.item_id ?? ''),
      positionId,
      goodsId: String(o.skuId ?? o.sku_id ?? o.goods_id ?? ''),
      goodsTitle: o.skuName ?? o.sku_name ?? o.goods_name ?? o.title ?? '',
      goodsImg: o.skuPic ?? o.pic ?? o.image ?? o.goods_img ?? '',
      payAmount: round2(payAmount),
      commissionRate,
      estCommission: round2(estCommission),
      settleCommission: status === 3 ? round2(settleCommission || estCommission) : 0,
      status,
      orderTime: parseDate(o.orderTime ?? o.create_time ?? o.order_time) ?? new Date(),
      settleTime: parseDate(o.settleTime ?? o.settle_time ?? o.finish_time),
      raw: o,
    };
  }
}
