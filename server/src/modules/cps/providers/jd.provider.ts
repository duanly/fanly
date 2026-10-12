import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ConvertedLink, CpsProvider, GoodsPage, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder,
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
 *   ✅ 商品详情 selling.goods.query —— 工具商接口
 *   ❌ 关键词搜索 goods.query —— 无权限，回落到京粉精选本地过滤
 *   ✅ 转链 selling.promotion.get —— 工具商转链
 *   ✅ 订单行 selling.order.row.query —— 工具商订单查询
 * 工具商接口（selling.*）都需要 access_token（授权Key）
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

  /**
   * 价格口径的说明，别删：
   *
   * 联盟接口给的「到手价」只算得上**可推广的券**，店铺满减、百亿补贴、
   * PLUS 价、限时秒杀它一概不知道。所以我们显示的券后价天然可能比用户在
   * 京东 App 里看到的高——那不是 bug，是联盟数据的边界。
   *
   * 反过来，绝不能自己拿券面额去减：券有门槛(quota)、有互斥、有领取上限，
   * 自己减出来的价十有八九偏低，用户点进去发现要多付钱，这个方向的错
   * 比显示贵了严重得多。所以一律以 lowestCouponPrice / lowestPrice 为准。
   */
  private mapGoods(r: any): UnifiedGoods {
    const pi = r.priceInfo ?? {};
    const ci = r.commissionInfo ?? {};
    const price = Number(pi.price ?? 0);

    const cp = Number(pi.lowestCouponPrice ?? pi.lowestPrice ?? price);
    // 兜底：字段缺失或明显不合理（比到原价还贵、为 0）时退回原价，
    // 宁可显示「没有券」，也不能显示一个假的低价
    const couponPrice = cp > 0 && cp <= price ? cp : price;

    // commissionShare 是百分数：5.0 表示 5%
    const rate = Number(ci.commissionShare ?? 0) / 100;
    // 佣金以京东返回的为准。自己用「券后价 × 佣金比例」算出来的数
    // 迟早跟结算对不上，而这个数直接决定给用户看的返利金额——是钱。
    const paid = Number(ci.commission);
    const commission = paid > 0 ? paid : round2(couponPrice * rate);

    if (price > 0 && cp > price) {
      this.logger.warn(`京东 ${r.skuId} 券后价(${cp})比原价(${price})还高，已按原价显示`);
    }

    return {
      platform: 'JD',
      goodsId: this.pickSkuId(r),
      title: r.skuName ?? '',
      // 白底图优先。京粉的营销主图上常把「￥367 券128 到手239」直接烧进图里，
      // 那套数字是商家自己做图时写的，跟接口返回的价格对不上是常态——
      // 一旦图上的数跟我们显示的券后价打架，用户当场就判我们虚标，
      // 比显示贵了严重得多。白底图没有任何文案，不会自己拆自己的台。
      image: r.whiteImage || r.imageInfo?.imageList?.[0]?.url || r.imgUrl || '',
      shopName: r.shopInfo?.shopName ?? '',
      price: round2(price),
      couponPrice: round2(couponPrice),
      couponAmount: round2(Math.max(price - couponPrice, 0)),
      commissionRate: rate,
      commission: round2(commission),
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
    return (await this.searchGoodsPage(p)).list;
  }

  /**
   * 带分页的关键词搜索。
   * ⚠️ 由于 goods.query 没权限，这里是从京粉精选里本地过滤，不是真的平台关键词搜索。
   * 为了支持「加载更多」，每次从第 1 页开始拉京粉精选，翻页累计，直到过滤结果凑够一页。
   */
  async searchGoodsPage(p: SearchParams): Promise<GoodsPage> {
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(Math.max(p.pageSize ?? 20, 10), 100);
    const kw = (p.keyword || '').trim();

    // 无关键词：走销量排序的榜单（相当于全品类浏览）
    if (!kw) {
      return this.recommendGoodsPage({ channel: 'coupon', page, pageSize });
    }

    // 有关键词：从京粉精选里本地过滤，多翻几页来凑够结果
    // 最多翻 5 页京粉精选（每页 100 条），避免打太多接口
    const MAX_JINGFEN_PAGES = 5;
    const all: UnifiedGoods[] = [];
    for (let i = 1; i <= MAX_JINGFEN_PAGES; i++) {
      const jf = await this.recommendGoodsPage({ channel: 'coupon', page: i, pageSize: 100 });
      const hit = jf.list.filter((g) => g.title.includes(kw));
      all.push(...hit);
      if (!jf.hasMore) break;
      // 已经凑够至少 page * pageSize + 1 条，就不用继续翻了
      if (all.length > page * pageSize) break;
    }

    const start = (page - 1) * pageSize;
    const list = all.slice(start, start + pageSize);
    return {
      list,
      total: all.length,
      page,
      hasMore: start + list.length < all.length,
    };
  }

  /**
   * 京粉精选：京东这边唯一确认能用的选品接口。
   * eliteId 是频道号，probe 实测 1~30 都能返数据。
   */
  async recommendGoods(p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    const page = await this.recommendGoodsPage(p);
    return page.list;
  }

  /**
   * 带分页的京粉精选。
   * hasMore 判断：返回数量等于 pageSize 就认为还有下一页。
   * 京粉精选没有 total 字段，只能用这个近似判断。
   */
  async recommendGoodsPage(p: RecommendParams = {}): Promise<GoodsPage> {
    const CHANNEL: Record<string, number> = {
      coupon: 1,   // 好券商品
      hot: 2,      // 超级大牌
      earn: 22,    // 高佣
      cheap: 4,    // 低价
      pick: 1,
    };
    const eliteId = CHANNEL[p.channel ?? 'coupon'] ?? 1;
    const page = Math.max(p.page ?? 1, 1);
    const pageSize = Math.min(Math.max(p.pageSize ?? 20, 20), 100);

    const data = await this.call<any>('jd.union.open.goods.jingfen.query', {
      goodsReq: { eliteId, pageIndex: page, pageSize },
    });
    const raw = data?.data ?? data ?? [];
    const list = (Array.isArray(raw) ? raw : []).map((r: any) => this.mapGoods(r));
    return {
      list,
      total: list.length,
      page,
      hasMore: list.length === pageSize,
    };
  }

  async getGoodsDetail(skuId: string): Promise<UnifiedGoods | null> {
    if (!skuId) return null;
    // 优先用 selling 接口（工具商/导购媒体已开通），失败再回落到 bigfield
    const attempts = [
      {
        name: 'selling.goods.query',
        method: 'jd.union.open.selling.goods.query',
        wrapper: 'goodsReq',
        params: { skuIds: [Number(skuId)] },
      },
      {
        name: 'goods.bigfield.query',
        method: 'jd.union.open.goods.bigfield.query',
        wrapper: 'goodsReq',
        params: { skuIds: [Number(skuId)], sceneId: 1 },
      },
    ];
    let lastError: Error | null = null;
    for (const att of attempts) {
      try {
        const data = await this.call<any>(att.method, { [att.wrapper]: att.params });
        const list = data?.data ?? data ?? [];
        const hit = Array.isArray(list) ? list[0] : list;
        if (hit) {
          if (att.name !== 'selling.goods.query') {
            this.logger.log(`京东详情使用 ${att.name} 成功`);
          }
          return this.mapGoods(hit);
        }
      } catch (e: any) {
        lastError = e;
        this.logger.debug(`京东详情 ${att.name} 失败: ${e.message}`);
      }
    }
    // 都失败了抛出去，让上层知道是接口问题不是商品下架
    if (lastError) throw lastError;
    return null;
  }

  async convertLink(skuId: string, positionId: string): Promise<ConvertedLink> {
    if (!this.opt.positionId) throw new Error('京东未配置推广位：请在 .env 填 JD_POSITION_ID');

    const materialId = `https://item.jd.com/${skuId}.html`;

    const tryCall = async (method: string, params: Record<string, any>, wrapper = 'promotionCodeReq') => {
      return this.call<any>(method, { [wrapper]: params });
    };

    // 按优先级依次尝试不同的转链接口，适配不同的媒体类型
    const attempts: Array<{ name: string; method: string; params: Record<string, any>; wrapper: string }> = [
      // 0. 工具商/导购媒体：selling.promotion.get（截图里明确显示已开通）
      //    工具商接口参数名可能不一样，先试 promotionReq，不行再试 promotionCodeReq
      {
        name: 'selling.promotion(promotionReq)',
        method: 'jd.union.open.selling.promotion.get',
        wrapper: 'promotionReq',
        params: {
          materialId,
          subUnionId: positionId,
          positionId: Number(this.opt.positionId),
        },
      },
      {
        name: 'selling.promotion(promotionCodeReq)',
        method: 'jd.union.open.selling.promotion.get',
        wrapper: 'promotionCodeReq',
        params: {
          materialId,
          subUnionId: positionId,
          positionId: Number(this.opt.positionId),
        },
      },
      // 1. 导购/工具媒体：bysubunionid（需要开通 subUnionId 权限）
      {
        name: 'bysubunionid',
        method: 'jd.union.open.promotion.bysubunionid.get',
        wrapper: 'promotionCodeReq',
        params: {
          materialId,
          subUnionId: positionId,
          positionId: Number(this.opt.positionId),
        },
      },
      // 2. 网站/APP 媒体：common 不传 siteId（有些账号不需要）
      {
        name: 'common(no siteId)',
        method: 'jd.union.open.promotion.common.get',
        wrapper: 'promotionCodeReq',
        params: {
          materialId,
          positionId: Number(this.opt.positionId),
          subUnionId: positionId,
        },
      },
    ];

    // 3. 网站类型：common 传 siteId（网站审核通过后才有用）
    if (this.opt.siteId) {
      attempts.push({
        name: 'common(with siteId)',
        method: 'jd.union.open.promotion.common.get',
        wrapper: 'promotionCodeReq',
        params: {
          materialId,
          positionId: Number(this.opt.positionId),
          siteId: Number(this.opt.siteId),
          subUnionId: positionId,
        },
      });
    }

    let lastError: Error | null = null;
    for (const att of attempts) {
      try {
        const data = await tryCall(att.method, att.params, att.wrapper);
        const url = data?.shortURL || data?.clickURL || '';
        if (!url) throw new Error('京东转链返回为空');
        if (att.name !== 'bysubunionid') {
          this.logger.log(`京东转链使用 ${att.name} 成功`);
        }
        return {
          platform: 'JD',
          goodsId: skuId,
          shortUrl: url,
          deeplink: data?.clickURL || url,
          password: '',
          positionId,
        };
      } catch (e: any) {
        lastError = e;
        this.logger.warn(`京东转链 ${att.name} 失败: ${e.message}`);
      }
    }

    throw lastError || new Error('京东转链全部失败');
  }

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    const m = /item\.jd\.com\/(\d+)\.html/.exec(text) ?? /\b(\d{8,})\b/.exec(text);
    return m ? this.getGoodsDetail(m[1]) : null;
  }

  async fetchOrders(start: Date, end: Date, page = 1): Promise<UnifiedOrder[]> {
    // 京东订单行接口参数格式版本很多，不同账号/不同时期可能不一样。
    // 这里按常见格式依次尝试，哪个成功用哪个。
    // 注意：京东限制单次查询时间范围不超过 1 小时，如果超过需要分段查。
    const fmtYmdHms = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', ' ').slice(0, 19); // yyyy-MM-dd HH:mm:ss
    const fmtYmdH = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', ' ').replace(/[-: ]/g, '').slice(0, 10); // yyyyMMddHH

    // 时间范围超过 1 小时的话，拆成 1 小时一段，每段独立查，结果合并
    const spanMs = end.getTime() - start.getTime();
    const ONE_HOUR = 60 * 60 * 1000;
    if (spanMs > ONE_HOUR) {
      const all: UnifiedOrder[] = [];
      let cursor = new Date(start.getTime());
      while (cursor < end) {
        const segEnd = new Date(Math.min(cursor.getTime() + ONE_HOUR, end.getTime()));
        const seg = await this.fetchOrders(cursor, segEnd, page);
        all.push(...seg);
        cursor = segEnd;
      }
      // 去重（按订单号 + 子订单）
      const seen = new Set<string>();
      return all.filter((o) => {
        const k = `${o.platformOrderNo}_${o.subOrderNo}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    const attempts: Array<{ name: string; method: string; biz: Record<string, any> }> = [
      // 版本 0：selling 接口（工具商/导购媒体类型），带 access_token
      // 对应 jd.union.open.selling.order.row.query
      {
        name: 'v0(selling order.row, orderReq, ymdHms)',
        method: 'jd.union.open.selling.order.row.query',
        biz: {
          orderReq: {
            pageNo: page, pageSize: 100,
            type: 3,
            startTime: fmtYmdHms(start), endTime: fmtYmdHms(end),
          },
        },
      },
      // 版本 1：orderReq 包裹 + yyyy-MM-dd HH:mm:ss + type
      {
        name: 'v1(orderReq, ymdHms, type)',
        method: 'jd.union.open.order.row.query',
        biz: {
          orderReq: {
            pageNo: page, pageSize: 100,
            type: 3,
            startTime: fmtYmdHms(start), endTime: fmtYmdHms(end),
          },
        },
      },
      // 版本 2：orderReq 包裹 + yyyyMMddHH + type（旧文档）
      {
        name: 'v2(orderReq, ymdH, type)',
        method: 'jd.union.open.order.row.query',
        biz: {
          orderReq: {
            pageNo: page, pageSize: 100,
            type: 3,
            startTime: fmtYmdH(start), endTime: fmtYmdH(end),
          },
        },
      },
      // 版本 3：平铺参数 + yyyy-MM-dd HH:mm:ss
      {
        name: 'v3(flat, ymdHms)',
        method: 'jd.union.open.order.row.query',
        biz: {
          pageNo: page, pageSize: 100,
          type: 3,
          startTime: fmtYmdHms(start), endTime: fmtYmdHms(end),
        },
      },
    ];

    // 如果配置了 unionId，给每个版本都加上
    if (this.opt.unionId) {
      for (const a of attempts) {
        if (a.biz.orderReq) a.biz.orderReq.unionId = this.opt.unionId;
        else a.biz.unionId = this.opt.unionId;
      }
    }

    const isTimeRangeError = (msg: string) =>
      /时间范围超过/.test(msg) || /查询时间/.test(msg) || /453/.test(msg);

    let lastError: Error | null = null;
    for (const att of attempts) {
      try {
        const data = await this.call<any>(att.method, att.biz);
        const list = data?.data ?? data ?? [];
        this.logger.log(`京东订单接口 ${att.name} 成功，返回 ${list.length} 条`);
        return (Array.isArray(list) ? list : []).map((o: any) => this.mapOrder(o));
      } catch (e: any) {
        lastError = e;
        // 如果是"时间范围超限"这种业务错误，说明格式是对的，直接往上抛，
        // 不用再试其他格式了（其他格式更不可能对）
        if (isTimeRangeError(e.message ?? '')) {
          this.logger.debug(`京东订单接口 ${att.name} 时间范围超限，格式正确，直接抛出`);
          throw e;
        }
        this.logger.debug(`京东订单接口 ${att.name} 失败: ${e.message}`);
      }
    }

    throw lastError || new Error('京东订单拉取失败');
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
