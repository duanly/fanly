import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionPosition } from '@/entities';
import { CpsService } from './cps.service';

/**
 * 平台授权（拼多多叫「推广位备案」）。
 *
 * 实测结论：拼多多的备案是按 **pid + custom_parameters 的组合** 记的，
 * 不是按 pid 记的。我们给每个用户一个独立的 custom_parameters（uid），
 * 所以每个用户都得自己授权一次，否则转链会报
 * 「未传入已经授权备案过的相关参数」。
 *
 * 授权状态存在 promotion_position 上，授权过就不再查接口——
 * 这是转链路径上的一步，多一次网络往返就多一分失败概率。
 */
@Injectable()
export class AuthzService {
  private readonly logger = new Logger(AuthzService.name);

  constructor(
    @InjectRepository(PromotionPosition) private readonly posRepo: Repository<PromotionPosition>,
    private readonly cps: CpsService,
  ) {}

  /** 目前只有拼多多要求用户逐个授权；别的平台以后按需加进来 */
  needsAuth(platform: string): boolean {
    return (platform || '').toUpperCase() === 'PDD';
  }

  private custom(positionId: string) {
    return JSON.stringify({ uid: positionId });
  }

  private provider(platform: string): any {
    return this.cps.get(platform);
  }

  private async position(userId: number, platform: string) {
    return this.posRepo.findOneBy({ userId, platform: platform.toUpperCase() });
  }

  /**
   * 查授权状态。
   * force=true 时忽略本地缓存去问平台——用户点「我已完成授权」时用。
   */
  async status(userId: number, platform: string, force = false) {
    const p = platform.toUpperCase();
    if (!this.needsAuth(p)) return { platform: p, needAuth: false, bound: true };

    const pos = await this.position(userId, p);
    if (!pos) return { platform: p, needAuth: true, bound: false, reason: '推广位缺失，请重新登录' };
    if (pos.bound && !force) return { platform: p, needAuth: false, bound: true };

    const provider = this.provider(p);
    if (typeof provider.queryAuthority !== 'function') {
      // mock 渠道没有这个方法，当作不需要授权，本地开发才跑得动
      return { platform: p, needAuth: false, bound: true };
    }

    try {
      const bound = await provider.queryAuthority(this.custom(pos.positionId));
      if (bound && !pos.bound) {
        pos.bound = true;
        pos.boundAt = new Date();
        await this.posRepo.save(pos);
        this.logger.log(`用户 ${userId} 完成 ${p} 授权`);
      }
      return { platform: p, needAuth: !bound, bound };
    } catch (e: any) {
      this.logger.warn(`查 ${p} 授权状态失败: ${e.message}`);
      // 查不到就别拦着用户，让他试——真没授权转链会自己报错
      return { platform: p, needAuth: false, bound: false, degraded: true };
    }
  }

  /** 生成授权链接，用户在拼多多里打开完成授权 */
  async authUrl(userId: number, platform: string) {
    const p = platform.toUpperCase();
    const pos = await this.position(userId, p);
    if (!pos) throw new Error('推广位缺失，请重新登录');

    const provider = this.provider(p);
    if (typeof provider.genAuthUrl !== 'function') {
      throw new Error(`${p} 渠道不支持授权链接`);
    }
    const r = await provider.genAuthUrl(this.custom(pos.positionId));
    return { platform: p, positionId: pos.positionId, ...r };
  }

  /**
   * 转链前的闸门。返回 null 表示可以继续，
   * 返回对象表示要先去授权，调用方原样回给前端。
   */
  async gate(userId: number, platform: string) {
    const s = await this.status(userId, platform);
    if (!s.needAuth) return null;
    try {
      const url = await this.authUrl(userId, platform);
      return { needAuth: true, platform: s.platform, auth: url };
    } catch (e: any) {
      return { needAuth: true, platform: s.platform, auth: null, reason: e.message };
    }
  }
}
