import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AggregatorProvider } from './providers/aggregator.provider';
import { MockProvider } from './providers/mock.provider';
import { PddProvider } from './providers/pdd.provider';
import { ConvertedLink, CpsProvider, SearchParams, UnifiedGoods, UnifiedOrder } from './cps.types';
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

  searchGoods(platform: string, p: SearchParams): Promise<UnifiedGoods[]> {
    return this.get(platform).searchGoods(p);
  }
  getGoodsDetail(platform: string, id: string): Promise<UnifiedGoods | null> {
    return this.get(platform).getGoodsDetail(id);
  }
  convertLink(platform: string, id: string, pid: string): Promise<ConvertedLink> {
    return this.get(platform).convertLink(id, pid);
  }
  fetchOrders(platform: string, s: Date, e: Date): Promise<UnifiedOrder[]> {
    return this.get(platform).fetchOrders(s, e);
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
