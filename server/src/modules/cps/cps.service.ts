import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AggregatorProvider } from './providers/aggregator.provider';
import { MockProvider } from './providers/mock.provider';
import { PddProvider } from './providers/pdd.provider';
import { JdProvider } from './providers/jd.provider';
import { DingdanxiaProvider } from './providers/dingdanxia.provider';
import { ConvertedLink, CpsProvider, GoodsPage, RecommendParams, SearchParams, UnifiedGoods, UnifiedOrder } from './cps.types';
import { TtlCache } from '@/common/ttl-cache';
import { explainParseFailure, parseShareContent } from '@/common/share-content';

export const PLATFORMS = ['PDD', 'JD', 'TB', 'DY'] as const;

/**
 * 渠道路由：业务层只跟它打交道，不认识任何具体服务商。
 * CPS_PROVIDER=mock 时全部平台走本地假数据，无需任何 key。
 */
@Injectable()
export class CpsService implements OnModuleInit {
  private readonly logger = new Logger(CpsService.name);
  private providers = new Map<string, CpsProvider>();

  /**
   * 选品结果缓存 10 分钟。
   * 首页和榜单是读多写少的东西，没必要每次打开都打平台接口——
   * 各家都有 QPS 限制，被限流了连用户的实时搜索一起挂。
   */
  private readonly goodsCache = new TtlCache<UnifiedGoods[]>(10 * 60 * 1000, 300);

  /**
   * 「见过的商品」快照，按 平台:商品ID 存 1 小时。
   *
   * 为什么要它：各平台的「商品详情」接口权限跟「搜索/榜单」是分开授权的，
   * 京东的 bigfield.query 现在就没批下来。后台在搜索结果里点「加入选品池」，
   * 服务端却要用详情接口再查一遍,结果查不到 → 报「商品不存在或已下架」,
   * 可商品明明就在眼前。列表里已经拿到的字段跟详情返回的是同一套,
   * 顺手存下来当兜底,比让运营干等平台审批实在。
   *
   * 不信任前端传过来的商品数据,是因为佣金率直接决定给用户看的返利金额,
   * 那是钱,只能以平台返回的为准。
   */
  private readonly seenGoods = new TtlCache<UnifiedGoods>(60 * 60 * 1000, 5000);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const mode = this.config.get<string>('CPS_PROVIDER', 'mock');

    // 拼多多单独开口子：只要填了 client_id 就走直连，不跟着全局 mode 走。
    // 四家里只有它不用授权、不用渠道备案，没理由等其他平台一起上。
    const pddId = this.config.get<string>('PDD_CLIENT_ID', '');
    const pddSecret = this.config.get<string>('PDD_CLIENT_SECRET', '');
    const pddPid = this.config.get<string>('PDD_PID', '');

    const used: string[] = [];
    for (const p of PLATFORMS) {
      // 京东跟拼多多一样单独开口子：填了 key 就直连，不跟全局 mode 走
      if (p === 'JD' && this.config.get('JD_APP_KEY') && this.config.get('JD_APP_SECRET')) {
        this.providers.set(p, new JdProvider({
          appKey: this.config.get<string>('JD_APP_KEY', ''),
          appSecret: this.config.get<string>('JD_APP_SECRET', ''),
          unionId: this.config.get<string>('JD_UNION_ID', ''),
          siteId: this.config.get<string>('JD_SITE_ID', ''),
          positionId: this.config.get<string>('JD_POSITION_ID', ''),
          accessToken: this.config.get<string>('JD_ACCESS_TOKEN', ''),
          gateway: this.config.get<string>('JD_GATEWAY', ''),
          // probe 探出来的业务参数字段名，不对的话所有接口都报「参数错误」
          paramMode: this.config.get<string>('JD_PARAM_MODE', ''),
        }));
        used.push('JD=direct');
        continue;
      }
      if (p === 'PDD' && pddId && pddSecret) {
        this.providers.set(p, new PddProvider({
          clientId: pddId,
          clientSecret: pddSecret,
          pid: pddPid,
          gateway: this.config.get<string>('PDD_GATEWAY', ''),
        }));
        used.push('PDD=direct');
        if (!pddPid) this.logger.warn('PDD_PID 为空，转链会失败——去多多进宝后台拿推广位 ID');
        continue;
      }
      // 淘宝单独开口子：填了订单侠 API key 就走订单侠
      if (p === 'TB' && this.config.get('DDX_API_KEY')) {
        this.providers.set(p, new DingdanxiaProvider({
          apiKey: this.config.get<string>('DDX_API_KEY', ''),
          pid: this.config.get<string>('TB_PID', ''),
          relationId: this.config.get<string>('TB_RELATION_ID', ''),
          baseUrl: this.config.get<string>('DDX_BASE_URL', ''),
        }));
        used.push('TB=dingdanxia');
        if (!this.config.get('TB_PID')) this.logger.warn('TB_PID 为空，淘宝转链会失败——去订单侠或淘宝联盟后台拿 PID');
        if (!this.config.get('TB_RELATION_ID')) this.logger.warn('TB_RELATION_ID 为空，淘宝转链会失败——去订单侠后台拿渠道管理ID');
        continue;
      }
      if (mode === 'aggregator') {
        this.providers.set(p, new AggregatorProvider(
          p,
          this.config.get('AGG_BASE_URL', ''),
          this.config.get('AGG_API_KEY', ''),
        ));
        used.push(`${p}=aggregator`);
      } else {
        this.providers.set(p, new MockProvider(p));
        used.push(`${p}=mock`);
      }
    }
    this.logger.log(`CPS 渠道: ${used.join(', ')}`);
  }

  get(platform: string): CpsProvider {
    const p = this.providers.get(platform?.toUpperCase());
    if (!p) throw new Error(`未知平台: ${platform}`);
    return p;
  }

  /** 测试用：拿到底层 mock 实例往里塞订单 */
  getMock(platform: string): MockProvider | null {
    const p = this.providers.get(platform?.toUpperCase());
    return p instanceof MockProvider ? p : null;
  }

  all(): CpsProvider[] { return [...this.providers.values()]; }

  /** 凡是从平台捞回来的商品都记一份快照，供 getGoodsDetail 兜底 */
  private remember(list: UnifiedGoods[]): UnifiedGoods[] {
    for (const g of list) {
      if (g?.goodsId) this.seenGoods.set(`${g.platform}:${g.goodsId}`, g);
    }
    return list;
  }

  async searchGoods(platform: string, p: SearchParams): Promise<UnifiedGoods[]> {
    return this.remember(await this.get(platform).searchGoods(p));
  }

  /** 带分页信息的搜索。渠道没实现 page 方法时，用 searchGoods 包一层（total=本页条数） */
  async searchGoodsPage(platform: string, p: SearchParams): Promise<GoodsPage> {
    const provider = this.get(platform);
    if (provider.searchGoodsPage) {
      const page = await provider.searchGoodsPage(p);
      return { ...page, list: this.remember(page.list) };
    }
    const list = this.remember(await provider.searchGoods(p));
    return { list, total: list.length, page: p.page ?? 1, hasMore: false };
  }

  /** 带分页信息的榜单。渠道没实现就回落到 recommendGoods / searchGoods */
  async recommendGoodsPage(platform: string, p: RecommendParams = {}): Promise<GoodsPage> {
    const provider = this.get(platform);
    if (provider.recommendGoodsPage) {
      const page = await provider.recommendGoodsPage(p);
      return { ...page, list: this.remember(page.list) };
    }
    const list = this.remember(await provider.recommendGoods?.(p) ?? await provider.searchGoods({
      pageSize: p.pageSize ?? 20, sort: 'sales',
    }));
    return { list, total: list.length, page: p.page ?? 1, hasMore: false };
  }

  /**
   * 商品详情。详情接口没权限或临时抽风时，回落到刚才列表里见过的那一份——
   * 数据略旧一点，总好过让后台加不进选品池。
   *
   * 返回 null 表示「商品确实不存在/已下架」；抛异常表示「接口错误，无法确认」。
   * 调用方（如 refreshOne）需要区分这两种情况：前者可以下架，后者应该保留。
   */
  async getGoodsDetail(platform: string, id: string): Promise<UnifiedGoods | null> {
    if (!id) return null;
    const key = `${platform.toUpperCase()}:${id}`;
    try {
      const g = await this.get(platform).getGoodsDetail(id);
      if (g?.goodsId) {
        this.seenGoods.set(key, g);
        return g;
      }
      const cached = this.seenGoods.get(key);
      if (cached) this.logger.warn(`${platform} 详情查不到 ${id}，用列表快照兜底`);
      // 详情接口正常返回了"空"，说明商品真的不存在/下架了
      // 有缓存就返回缓存（数据旧一点但能用），没有就返回 null
      return cached ?? null;
    } catch (e: any) {
      const cached = this.seenGoods.get(key);
      this.logger.warn(
        `${platform} 详情 ${id} 失败(${e.message})，${cached ? '用列表快照兜底' : '且无快照可用'}`,
      );
      if (cached) return cached;
      // 接口报错 + 没有缓存 → 把异常抛出去，让上层知道是接口问题不是商品下架
      throw e;
    }
  }
  convertLink(platform: string, id: string, pid: string): Promise<ConvertedLink> {
    return this.get(platform).convertLink(id, pid);
  }
  fetchOrders(platform: string, s: Date, e: Date): Promise<UnifiedOrder[]> {
    return this.get(platform).fetchOrders(s, e);
  }

  /** 后台改了选品或分成比例之后叫一下，让下一次请求拿到新数据 */
  clearGoodsCache() {
    this.goodsCache.clear();
  }

  /** 官方榜单；渠道没实现或返回空就回落到销量搜索，首页不能开天窗 */
  async recommendGoods(platform: string, p: RecommendParams = {}): Promise<UnifiedGoods[]> {
    const provider = this.get(platform);
    const key = `rec|${platform}|${p.channel ?? 'earn'}|${p.page ?? 1}|${p.pageSize ?? 20}`;

    return this.remember(await this.goodsCache.wrap(key, async () => {
      if (typeof provider.recommendGoods === 'function') {
        try {
          const list = await provider.recommendGoods(p);
          if (list.length) return list;
          this.logger.warn(`${platform} 榜单返回空，回落到搜索`);
        } catch (e: any) {
          this.logger.warn(`${platform} 榜单失败，回落到搜索: ${e.message}`);
        }
      }
      return provider.searchGoods({ pageSize: p.pageSize ?? 20, sort: 'sales' });
    }));
  }

  /**
   * 跨平台搜索。
   *
   * 四家并发查，谁慢谁超时、谁挂了跳过谁——一家抽风不能让整个搜索白屏，
   * 这是「统一货架」能不能立住的关键：用户搜一次要看到所有平台的结果。
   *
   * 排序同样按佣金金额降序（等价于按到手返利降序，见 searchByRebate 的说明），
   * 所以跨平台混排的口径是一致的。
   */
  async searchAll(
    params: SearchParams,
    platforms?: string[],
    timeoutMs = 6000,
  ): Promise<UnifiedGoods[]> {
    const targets = (platforms?.length ? platforms : [...PLATFORMS]).map((p) => p.toUpperCase());
    const size = Math.max(params.pageSize ?? 20, 10);
    const key = `all|${targets.join(',')}|${params.keyword ?? ''}|${size}|${params.sort ?? ''}`;

    return this.remember(await this.goodsCache.wrap(key, async () => {
      const batches = await Promise.all(targets.map((p) => {
        const task = this.get(p)
          .searchGoods({ ...params, pageSize: size })
          .catch((e: any) => {
            this.logger.warn(`${p} 搜索失败，跳过: ${e.message}`);
            return [] as UnifiedGoods[];
          });
        // 超时只是不等它了，底下的请求继续跑完，下次缓存能用上
        return Promise.race([
          task,
          new Promise<UnifiedGoods[]>((r) => setTimeout(() => {
            this.logger.warn(`${p} 搜索超过 ${timeoutMs}ms，先不等了`);
            r([]);
          }, timeoutMs)),
        ]);
      }));

      const seen = new Set<string>();
      return batches
        .flat()
        .filter((g) => {
          const k = `${g.platform}:${g.goodsId}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => b.commission - a.commission)
        .slice(0, size);
    }));
  }

  /**
   * 按「到手返利」排序。
   *
   * 返利 = 佣金金额 × 用户分成比例，而分成比例对每件商品都一样，
   * 所以按佣金金额降序就等于按返利降序，不用把比例传进来。
   *
   * 为什么不用平台自带的排序：拼多多能按「佣金比例」排，但那个指标是反的——
   * 9.9 元 20% 只返 1 块，200 元 5% 返 5 块，用户要的显然是后者。
   * 多拉几页回来自己算，顺便把各平台的排序口径统一了。
   */
  async searchByRebate(
    platform: string,
    params: SearchParams,
    pages = 3,
  ): Promise<UnifiedGoods[]> {
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const key = `rebate|${platform}|${params.keyword ?? ''}|${pages}|${pageSize}`;

    return this.remember(await this.goodsCache.wrap(key, async () => {
      const provider = this.get(platform);
      const batches = await Promise.all(
        Array.from({ length: pages }, (_, i) =>
          provider
            .searchGoods({ ...params, page: i + 1, pageSize: 100 })
            .catch((e: any) => {
              this.logger.warn(`${platform} 第 ${i + 1} 页拉取失败: ${e.message}`);
              return [] as UnifiedGoods[];
            }),
        ),
      );

      const seen = new Set<string>();
      return batches
        .flat()
        .filter((g) => {
          if (!(g.commission > 0) || seen.has(g.goodsId)) return false;
          seen.add(g.goodsId);
          return true;
        })
        .sort((a, b) => b.commission - a.commission)
        .slice(0, pageSize);
    }));
  }

  /**
   * 口令/链接解析。
   *
   * 先在本地认出是哪个平台，只调那一家的接口——比挨个平台瞎试快，
   * 失败时也能告诉用户到底哪儿不对，而不是干巴巴一句「没认出来」。
   */
  async parseAny(text: string): Promise<{
    goods: UnifiedGoods | null;
    platform?: string;
    reason?: string;
  }> {
    const hit = parseShareContent(text);
    if (!hit) {
      return { goods: null, reason: explainParseFailure(text) };
    }

    this.logger.debug(`识别为 ${hit.platform} / ${hit.kind} / ${hit.token}`);
    const provider = this.providers.get(hit.platform);
    if (!provider) {
      return { goods: null, platform: hit.platform, reason: `暂未接入${hit.platform}渠道` };
    }

    try {
      // 商品 ID 能直查就直查，省一次解析调用
      const goods = hit.kind === 'goodsId'
        ? (await provider.getGoodsDetail(hit.token)) ?? (await provider.parseContent(text))
        : await provider.parseContent(text);

      if (goods) return { goods, platform: hit.platform };
      return {
        goods: null,
        platform: hit.platform,
        reason: hit.title
          ? `没查到「${hit.title}」，可能是该商品没有返利`
          : '这个商品暂时没有返利，换一个试试',
      };
    } catch (e) {
      this.logger.warn(`${hit.platform} 解析失败: ${e.message}`);
      return { goods: null, platform: hit.platform, reason: '解析服务暂时不可用，稍后再试' };
    }
  }
}
