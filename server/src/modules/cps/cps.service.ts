import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AggregatorProvider } from './providers/aggregator.provider';
import { MockProvider } from './providers/mock.provider';
import { ConvertedLink, CpsProvider, SearchParams, UnifiedGoods, UnifiedOrder } from './cps.types';

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
    for (const p of PLATFORMS) {
      if (mode === 'aggregator') {
        this.providers.set(p, new AggregatorProvider(
          p,
          this.config.get('AGG_BASE_URL', ''),
          this.config.get('AGG_API_KEY', ''),
        ));
      } else {
        this.providers.set(p, new MockProvider(p));
      }
    }
    this.logger.log(`CPS 渠道模式: ${mode}，已注册平台: ${[...this.providers.keys()].join(', ')}`);
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

  /** 口令解析：挨个平台试，谁认出来算谁的 */
  async parseAny(text: string): Promise<UnifiedGoods | null> {
    for (const [name, p] of this.providers) {
      try {
        const g = await p.parseContent(text);
        if (g) return g;
      } catch (e) {
        this.logger.debug(`${name} 解析失败: ${e.message}`);
      }
    }
    return null;
  }
}
