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
   * 2. 嵌套结构（物料精选接口）：item_basic_info、price_promotion_info、income_info 分开
   * 这里两种都兼容，从所有可能的位置找。
   */
  private mapGoods(raw: any): UnifiedGoods {
    const basic = raw.item_basic_info ?? raw;
    const priceInfo = raw.price_promotion_info ?? raw;
    const incomeInfo = raw.income_info ?? raw;
    const couponInfo = raw.coupon_info ?? raw;

    // 价格：优先从 price_promotion_info 里取，再试顶层，再试 basic 里的
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
    let couponPrice = Number(raw.final_price ?? raw.coupon_price_after ?? couponInfo.final_price ?? 0);
    if (!couponPrice) couponPrice = Math.max(price - couponAmount, 0);

    // 佣金比例是百分数，比如 15.0 表示 15%
    const rate = Number(
      incomeInfo.income_rate
        ?? raw.income_rate
        ?? raw.commission_rate
        ?? raw.promotion_rate
        ?? raw.tk_rate
        ?? incomeInfo.commission_rate
        ?? 0,
    ) / 100;

    // 佣金金额：有就直接用，没有自己算
    const commissionRaw = Number(
      raw.commission
        ?? raw.promotion_amount
        ?? raw.tk_commission
        ?? incomeInfo.income_amount
        ?? incomeInfo.commission
        ?? 0,
    );
    const commission = commissionRaw > 0 ? commissionRaw : round2(couponPrice * rate);

    // 商品 ID：顶层 item_id 优先
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

    return {
      platform: 'TB',
      goodsId,
      title: basic.title ?? basic.goods_name ?? basic.name ?? raw.title ?? '',
      image,
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
      // 有搜索词：超级搜索
      const params: Record<string, any> = {
        q: p.keyword,
        page_no: page,
        page_size: pageSize,
        sort: sortMap[p.sort ?? ''] ?? 'tk_total_sales_des',
      };
      const data = await this.call<any>('/tbk/super_search_material', params);
      const list = this.extractList(data).map((r: any) => this.mapGoods(r));
      const total = Number(data?.total_count ?? data?.total ?? 0);
      return {
        list,
        total,
        page,
        hasMore: list.length === pageSize,
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
    // 调试：打印第一条数据结构，确认字段名
    if (rawList.length > 0) {
      this.logger.debug(`物料精选返回样例 keys=${Object.keys(rawList[0]).join(',')}`);
      if (rawList[0].item_basic_info) {
        this.logger.debug(`item_basic_info keys=${Object.keys(rawList[0].item_basic_info).join(',')}`);
      }
      if (rawList[0].price_promotion_info) {
        this.logger.debug(`price_promotion_info keys=${Object.keys(rawList[0].price_promotion_info).join(',')}`);
      }
      if (rawList[0].publish_info) {
        this.logger.debug(`publish_info keys=${Object.keys(rawList[0].publish_info).join(',')}`);
      }
      if (rawList[0].scope_info) {
        this.logger.debug(`scope_info keys=${Object.keys(rawList[0].scope_info).join(',')}`);
      }
      if (rawList[0].presale_info) {
        this.logger.debug(`presale_info keys=${Object.keys(rawList[0].presale_info).join(',')}`);
      }
      // 打印第一条完整数据（方便排查）
      this.logger.debug(`第一条完整数据: ${JSON.stringify(rawList[0]).slice(0, 2000)}`);
    }
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
    // 订单侠的详情接口待定，先用搜索接口按 item_id 查（很多聚合平台支持这种方式）
    // 如果有专门的 detail 接口再换
    try {
      const data = await this.call<any>('/tbk/item_detail', { item_id: goodsId });
      const item = data?.list?.[0] ?? data?.item ?? data;
      return item ? this.mapGoods(item) : null;
    } catch (e: any) {
      this.logger.warn(`订单侠详情接口失败(${e.message})，暂无兜底`);
      return null;
    }
  }

  /**
   * 万能转链。
   * 需要 pid + relation_id（渠道管理ID）都是必填。
   * 订单归属：通过 relation_id 下面的 pid，或者用额外的 custom 参数。
   * 订单侠的 custom_parameters 字段可以传自定义跟踪参数。
   */
  async convertLink(goodsId: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.pid) throw new Error('订单侠未配置淘宝 PID：请在 .env 填 TB_PID');
    if (!this.opt.relationId) throw new Error('订单侠未配置渠道管理ID：请在 .env 填 TB_RELATION_ID');

    const data = await this.call<any>('/tbk/general_convert', {
      item_id: goodsId,
      pid: this.opt.pid,
      relation_id: this.opt.relationId,
      // 自定义跟踪参数，用于订单归属（淘宝联盟的 custom_parameters）
      // 订单侠有些版本支持 external_id 或 special_id，先用这个
      external_id: positionId,
      // 需要返回多种链接类型
      required_link_type: 'coupon_short_url,cps_short_url,coupon_long_url',
    });

    const shortUrl = data?.coupon_short_url ?? data?.cps_short_url ?? data?.short_url ?? data?.click_url ?? '';
    const tpwd = data?.tpwd ?? data?.password ?? data?.model ?? data?.tbk_pwd ?? '';
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
