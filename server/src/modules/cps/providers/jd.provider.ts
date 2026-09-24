import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ConvertedLink, CpsProvider, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

export interface JdOptions {
  appKey: string;
  appSecret: string;
  /** 联盟ID */
  unionId: string;
  /** 媒体ID */
  siteId: string;
  /** 推广位ID，转链带它做订单归属 */
  positionId: string;
  accessToken?: string;
  gateway?: string;
  /** 业务参数字段名，probe 探出来的：param_json / 360buy / flat */
  paramMode?: string;
}

const DEFAULT_GATEWAY = 'https://api.jd.com/routerjson';

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * 京东联盟渠道。
 *
 * 跟拼多多有三处正好相反，写的时候最容易翻车：
 *   1. 金额单位是**元**，不是分
 *   2. 佣金比例是**百分数**（5.0 = 5%），不是千分比
 *   3. 时间戳是**北京时间字符串** yyyy-MM-dd HH:mm:ss，不是 Unix 秒
 *
 * 还有两个京东独有的：业务参数要整个塞进一个字段（不平铺），
 * 响应数据外面还裹了一层 JSON **字符串**，得再 parse 一次。
 *
 * ⚠️ 当前账号的权限状况（probe 实测，不是猜的）：
 *   ✅ 京粉精选 goods.jingfen.query —— 选品靠它
 *   ✅ 类目 category.goods.get
 *   ⚠️ 商品详情 bigfield.query —— 要 sceneId，参数还在调
 *   ❌ 关键词搜索 goods.query —— 无权限，回落到京粉精选本地过滤
 *   ❌ 通用转链 —— 报「只支持网站/APP」，我们的媒体是导购媒体类型
 *   ⚠️ 订单行 order.row.query —— 参数还没对上
 * 所以现在京东**只能选品，不能转链和拉单**，转链和拉单会明确抛错，
 * 不静默返回空——假装成功比失败更糟。
 */
export class JdProvider implements CpsProvider {
  readonly platform = 'JD';
  private readonly logger = new Logger(JdProvider.name);
  private readonly gateway: string;

  constructor(private readonly opt: JdOptions) {
    this.gateway = opt.gateway || DEFAULT_GATEWAY;
  }

  // ───────────────────────── 网关 ─────────────────────────

  private beijingNow(): string {
    return new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', ' ');
  }

  private sign(params: Record<string, string>): string {
    const raw = this.opt.appSecret
      + Object.keys(params).sort().map((k) => k + params[k]).join('')
      + this.opt.appSecret;
    return createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
  }

  private async call<T = any>(method: string, biz: Record<string, any>): Promise<T> {
    if (!this.opt.appKey || !this.opt.appSecret) {
      throw new Error('京东未配置：请在 .env 填 JD_APP_KEY / JD_APP_SECRET');
    }

    const params: Record<string, string> = {
      method,
      app_key: this.opt.appKey,
      timestamp: this.beijingNow(),
      format: 'json',
      v: '1.0',
      sign_method: 'md5',
    };
    if (this.opt.accessToken) params.access_token = this.opt.accessToken;

    const mode = this.opt.paramMode || 'param_json';
    if (mode === '360buy') params['360buy_param_json'] = JSON.stringify(biz);
    else if (mode === 'flat') {
      for (const [k, v] of Object.entries(biz)) {
        params[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
    } else params.param_json = JSON.stringify(biz);

    params.sign = this.sign(params);

    const res = await fetch(this.gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`京东网关 HTTP ${res.status}`);

    const json: any = await res.json();
    if (json.error_response) {
      const e = json.error_response;
      throw new Error(`京东 ${method}: ${e.code || ''} ${e.zh_desc || e.en_desc || ''}`);
    }

    // 京东把 response 拼成了 responce，沿用至今，别按 response 找
    const outerKey = Object.keys(json).find((k) => k.endsWith('_responce')) ?? Object.keys(json)[0];
    const outer = json[outerKey] ?? {};
    if (outer.code && String(outer.code) !== '0') {
      throw new Error(`京东 ${method}: ${outer.code} ${outer.msg || ''}`);
    }

    // 真正的数据还裹着一层 JSON 字符串，要再 parse 一次
    const resultKey = Object.keys(outer).find((k) => k.endsWith('Result'));
    if (!resultKey) return outer as T;
    const inner = typeof outer[resultKey] === 'string'
      ? JSON.parse(outer[resultKey])
      : outer[resultKey];
    if (inner.code !== undefined && ![200, 0].includes(Number(inner.code))) {
      throw new Error(`京东 ${method}: ${inner.code} ${inner.message || ''}`);
    }
    return (inner.data !== undefined ? inner.data : inner) as T;
  }

  // ───────────────────────── 字段映射 ─────────────────────────

  /**
   * 从一条京东商品里挖出 skuId。
   *
   * 不同接口的字段名不一致（京粉精选实测就取不到 skuId），
   * 但 materialUrl 里一定带着它，所以拿它当最后的兜底。
   * goodsId 空了转链、加购、选品池、比价组全都定位不到商品，不能含糊。
   */
  private pickSkuId(r: any): string {
    const direct = r.skuId ?? r.skuid ?? r.sku_id ?? r.itemId ?? r.id;
    if (direct !== undefined && direct !== null && String(direct) !== '') {
      return String(direct);
    }
    for (const u of [r.materialUrl, r.itemUrl, r.clickURL, r.shortURL]) {
      const m = /item\.jd\.com\/(\d+)/.exec(String(u ?? ''));
      if (m) return m[1];
    }
    this.logger.warn(`京东商品取不到 skuId，字段有: ${Object.keys(r || {}).join(',')}`);
    return '';
  }

  private mapGoods(r: any): UnifiedGoods {
    const price = Number(r.priceInfo?.price ?? 0);
    const couponPrice = Number(r.priceInfo?.lowestCouponPrice ?? r.priceInfo?.lowestPrice ?? price);
    // commissionShare 是百分数：5.0 表示 5%
    const rate = Number(r.commissionInfo?.commissionShare ?? 0) / 100;

    return {
      platform: 'JD',
      goodsId: this.pickSkuId(r),
      title: r.skuName ?? '',
      image: (r.imageInfo?.imageList?.[0]?.url) ?? r.imgUrl ?? '',
      shopName: r.shopInfo?.shopName ?? '',
      price: round2(price),
      couponPrice: round2(couponPrice),
      couponAmount: round2(Math.max(price - couponPrice, 0)),
      commissionRate: rate,
      commission: round2(couponPrice * rate),
      salesVolume: Number(r.inOrderCount30Days ?? r.inOrderCount ?? 0),
    };
  }

  // ───────────────────────── CpsProvider ─────────────────────────

  /**
   * 关键词搜索。
   * goods.query 没权限，所以退而求其次：拉京粉精选再按标题过滤。
   * 命中率远不如真搜索，权限批下来要第一时间换掉。
   */
  async searchGoods(p: SearchParams): Promise<UnifiedGoods[]> {
    const size = Math.min(p.pageSize ?? 20, 100);
    const pool = await this.recommendGoods({ pageSize: 100, channel: 'coupon' });
    const kw = (p.keyword || '').trim();
    const hit = kw ? pool.filter((g) => g.title.includes(kw)) : pool;
    return hit.slice(0, size);
  }

  /**
   * 京粉精选：京东这边唯一确认能用的选品接口。
   * eliteId 是频道号，probe 实测 1~30 都能返数据。
   */
  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    const CHANNEL: Record<string, number> = {
      coupon: 1,   // 好券商品
      hot: 2,      // 超级大牌
      earn: 22,    // 高佣
      cheap: 4,    // 低价
      pick: 1,
    };
    const eliteId = CHANNEL[p.channel ?? 'coupon'] ?? 1;
    const pageSize = Math.min(Math.max(p.pageSize ?? 20, 20), 100);

    const data = await this.call<any>('jd.union.open.goods.jingfen.query', {
      goodsReq: { eliteId, pageIndex: Math.max(p.page ?? 1, 1), pageSize },
    });
    const list = data?.data ?? data ?? [];
    return (Array.isArray(list) ? list : []).map((r: any) => this.mapGoods(r));
  }

  async getGoodsDetail(skuId: string): Promise<UnifiedGoods | null> {
    if (!skuId) return null;
    try {
      const data = await this.call<any>('jd.union.open.goods.bigfield.query', {
        goodsReq: { skuIds: [Number(skuId)], sceneId: 1 },
      });
      const list = data?.data ?? data ?? [];
      const hit = Array.isArray(list) ? list[0] : list;
      return hit ? this.mapGoods(hit) : null;
    } catch (e: any) {
      // bigfield.query 的权限跟京粉精选是分开审批的，现在还没批下来。
      // 这里不再自己去精选池里捞（白打一次 100 条的接口还多半捞不着），
      // 交给 CpsService 用列表快照兜底。
      this.logger.warn(`京东详情 ${skuId} 失败: ${e.message}`);
      return null;
    }
  }

  async convertLink(skuId: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.positionId) throw new Error('京东未配置推广位：请在 .env 填 JD_POSITION_ID');

    const data = await this.call<any>('jd.union.open.promotion.common.get', {
      promotionCodeReq: {
        materialId: `https://item.jd.com/${skuId}.html`,
        positionId: Number(this.opt.positionId),
        // subUnionId 要单独申请权限；没权限时京东会忽略这个字段，
        // 归属就只能靠 positionId
        subUnionId: positionId,
        ...(this.opt.siteId ? { siteId: Number(this.opt.siteId) } : {}),
      },
    });

    const url = data?.shortURL || data?.clickURL || '';
    if (!url) throw new Error('京东转链返回为空');
    return {
      platform: 'JD',
      goodsId: skuId,
      shortUrl: url,
      deeplink: data?.clickURL || url,
      password: '',
      positionId,
    };
  }

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    const m = /item\.jd\.com\/(\d+)\.html/.exec(text) ?? /\b(\d{8,})\b/.exec(text);
    return m ? this.getGoodsDetail(m[1]) : null;
  }

  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    // 京东订单行的时间格式是 yyyyMMddHH，精确到小时
    const hh = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', ' ').replace(/[-: ]/g, '').slice(0, 10);

    const data = await this.call<any>('jd.union.open.order.row.query', {
      orderReq: {
        pageNo: page, pageSize: 100,
        type: 3,                       // 3 = 按更新时间，拉增量用它
        startTime: hh(start), endTime: hh(end),
      },
    });
    const list = data?.data ?? data ?? [];
    return (Array.isArray(list) ? list : []).map((o: any) => this.mapOrder(o));
  }

  /**
   * 京东订单状态 validCode：
   *   -1 已取消 / 2 无效-拆单 / 3 无效-取消 / 4 无效-京东帮 / 5 无效-账号异常
   *   / 6 无效-赠品类 / 7 无效-售后拒收 / 8 无效-店铺异常 / 9 无效-其他
   *   / 15 待付款 / 16 已付款 / 17 已完成 / 18 已结算
   */
  private mapOrder(o: any): UnifiedOrder {
    const vc = Number(o.validCode);
    const status = vc === 18 ? 3 : vc === 17 ? 2 : vc === 16 ? 1 : 4;

    const sku = o.skuList?.[0] ?? {};
    const est = Number(sku.estimateFee ?? 0);
    const actual = Number(sku.actualFee ?? 0);
    const ts = (v: any) => (v ? new Date(Number(v)) : undefined);

    return {
      platform: 'JD',
      platformOrderNo: String(o.orderId ?? ''),
      subOrderNo: String(sku.skuId ?? ''),
      // 有 subUnionId 权限就用它，没有就退回推广位反查
      positionId: o.subUnionId || String(o.positionId ?? ''),
      goodsId: String(sku.skuId ?? ''),
      goodsTitle: sku.skuName ?? '',
      goodsImg: '',
      payAmount: round2(Number(o.estimateCosPrice ?? sku.estimateCosPrice ?? 0)),
      commissionRate: Number(sku.commissionRate ?? 0) / 100,
      estCommission: round2(est),
      settleCommission: status === 3 ? round2(actual || est) : 0,
      status,
      orderTime: ts(o.orderTime) ?? new Date(),
      settleTime: ts(o.finishTime),
      raw: o,
    };
  }
}
