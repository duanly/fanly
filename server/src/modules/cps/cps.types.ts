/** 各平台归一后的商品模型 */
export interface UnifiedGoods {
  platform: string;
  goodsId: string;
  title: string;
  image: string;
  shopName: string;
  /** 原价 */
  price: number;
  /** 券后价 */
  couponPrice: number;
  /** 优惠券面额 */
  couponAmount: number;
  /** 佣金率 0~1 */
  commissionRate: number;
  /** 平台预估可得佣金 */
  commission: number;
  salesVolume: number;
}

/** 转链结果 */
export interface ConvertedLink {
  platform: string;
  goodsId: string;
  /** H5 短链 */
  shortUrl: string;
  /** 唤起 App 的 deeplink */
  deeplink: string;
  /** 淘口令 / 京东口令，没有则空 */
  password: string;
  /** 本次转链带的子渠道参数，订单归属靠它 */
  positionId: string;
}

/** 平台原始订单归一后的结构 */
export interface UnifiedOrder {
  platform: string;
  platformOrderNo: string;
  subOrderNo: string;
  /** 子渠道参数，用于反解 userId */
  positionId: string;
  goodsId: string;
  goodsTitle: string;
  goodsImg: string;
  payAmount: number;
  commissionRate: number;
  estCommission: number;
  settleCommission: number;
  /** 1 已付款 2 已收货 3 已结算 4 已失效 */
  status: number;
  orderTime: Date;
  settleTime?: Date;
  raw?: any;
}

export interface SearchParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
  /** 排序：sales | commission | price */
  sort?: string;
}

/**
 * 所有 CPS 渠道必须实现的统一接口。
 * 业务层永远只依赖这四个方法，换服务商 / 换直连只换实现。
 */
export interface CpsProvider {
  readonly platform: string;
  searchGoods(params: SearchParams): Promise<UnifiedGoods[]>;
  getGoodsDetail(goodsId: string): Promise<UnifiedGoods | null>;
  convertLink(goodsId: string, positionId: string): Promise<ConvertedLink>;
  /** 解析淘口令 / 分享链接 */
  parseContent(text: string): Promise<UnifiedGoods | null>;
  /** 拉取区间内有变更的订单 */
  fetchOrders(start: Date, end: Date, page?: number): Promise<UnifiedOrder[]>;
}
