import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionPosition, User } from '@/entities';
import { OrderService } from '../order/order.service';
import { JutuikeProvider } from './jutuike.provider';

/**
 * 聚推客本地生活 CPS 服务。
 *
 * 覆盖美团/饿了么/滴滴/酒店/电影票等 30+ 品牌，
 * 以活动分发为核心：活动列表 → 转链 → 用户跳转平台下单 → 拿佣金。
 */
@Injectable()
export class JutuikeService {
  private readonly logger = new Logger(JutuikeService.name);
  private readonly provider: JutuikeProvider | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PromotionPosition) private readonly posRepo: Repository<PromotionPosition>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly orderService: OrderService,
  ) {
    const apiKey = this.config.get<string>('JTK_API_KEY', '');
    if (apiKey) {
      this.provider = new JutuikeProvider({
        apiKey,
        baseUrl: this.config.get<string>('JTK_BASE_URL', ''),
      });
      this.logger.log('聚推客已启用');
    } else {
      this.logger.warn('聚推客未配置（JTK_API_KEY 为空），相关功能不可用');
    }
  }

  private ensureProvider(): JutuikeProvider {
    if (!this.provider) throw new BadRequestException('聚推客暂未配置');
    return this.provider;
  }

  // ─── 活动列表 ───

  async activities(params: {
    page?: number;
    pageSize?: number;
    cateName?: string;
  }) {
    const p = this.ensureProvider();
    const r = await p.actList({
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      cateName: params.cateName || '',
    });
    return {
      list: r.list,
      total: r.total,
      page: r.page,
      pageSize: r.pageSize,
      hasMore: r.page < r.lastPage,
    };
  }

  // ─── 活动转链 ───

  async convert(actId: number, userId: number) {
    const p = this.ensureProvider();
    let pos = await this.posRepo.findOneBy({ userId, platform: 'JTK' });
    if (!pos) {
      // 兜底：如果没有 JTK 推广位，当场创建
      const user = await this.userRepo.findOneBy({ id: userId });
      if (!user) throw new BadRequestException('用户不存在');
      const code = this.genSid(userId);
      const saved = await this.posRepo.save(this.posRepo.create({
        userId,
        platform: 'JTK',
        positionId: code,
        bound: true, // 聚推客的 sid 不需要备案，传了就能跟单
      }));
      pos = saved;
    }

    const r = await p.convertAct(actId, pos.positionId);
    return r;
  }

  // ─── 饿了么 ───

  async eleActivities(params: { page?: number; pageSize?: number }) {
    const p = this.ensureProvider();
    return await p.eleList({
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    });
  }

  async eleConvert(activityId: string, userId: number) {
    const p = this.ensureProvider();
    let pos = await this.posRepo.findOneBy({ userId, platform: 'JTK' });
    if (!pos) {
      const user = await this.userRepo.findOneBy({ id: userId });
      if (!user) throw new BadRequestException('用户不存在');
      const code = this.genSid(userId);
      const saved = await this.posRepo.save(this.posRepo.create({
        userId,
        platform: 'JTK',
        positionId: code,
        bound: true,
      }));
      pos = saved;
    }
    return await p.eleConvert(activityId, pos.positionId);
  }

  // ─── 美团券包 ───

  async mtCouponList(params: { page?: number; pageSize?: number }) {
    const p = this.ensureProvider();
    return await p.mtCouponList({
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    });
  }

  async mtCouponConvert(actId: string, userId: number) {
    const p = this.ensureProvider();
    let pos = await this.posRepo.findOneBy({ userId, platform: 'JTK' });
    if (!pos) {
      const user = await this.userRepo.findOneBy({ id: userId });
      if (!user) throw new BadRequestException('用户不存在');
      const code = this.genSid(userId);
      const saved = await this.posRepo.save(this.posRepo.create({
        userId,
        platform: 'JTK',
        positionId: code,
        bound: true,
      }));
      pos = saved;
    }
    return await p.mtCouponConvert(actId, pos.positionId);
  }

  private genSid(userId: number): string {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `JTK${userId}X${rand}`;
  }

  // ─── 订单同步 ───

  /**
   * 同步最近 N 小时的聚推客订单。
   * 聚推客订单接口时间范围不能超过 1 小时，按小时拆段拉取。
   */
  async syncOrders(hours = 2): Promise<{ fetched: number; upserted: number }> {
    if (!this.provider) return { fetched: 0, upserted: 0 };

    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600_000);
    return this.syncRange(start, end);
  }

  /**
   * 全量对账：拉最近 N 天的订单。
   */
  async syncOrdersFull(days = 30): Promise<{ fetched: number; upserted: number }> {
    if (!this.provider) return { fetched: 0, upserted: 0 };

    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 3600_000);
    return this.syncRange(start, end);
  }

  private async syncRange(start: Date, end: Date): Promise<{ fetched: number; upserted: number }> {
    const p = this.ensureProvider();
    let fetched = 0;
    let upserted = 0;

    // 按 1 小时拆段（聚推客限制时间范围 ≤ 1 小时）
    const HOUR = 3600_000;
    let curStart = new Date(start.getTime());

    while (curStart < end) {
      const curEnd = new Date(Math.min(curStart.getTime() + HOUR, end.getTime()));

      try {
        let page = 1;
        let lastPage = 1;
        do {
          const r = await p.fetchOrders(curStart, curEnd, page, 2); // query_type=2 按更新时间
          for (const order of r.list) {
            fetched++;
            try {
              await this.orderService.upsert(order);
              upserted++;
            } catch (e: any) {
              this.logger.error(`聚推客订单落库失败 ${order.platformOrderNo}: ${e.message}`);
            }
          }
          lastPage = r.lastPage;
          page++;
        } while (page <= lastPage);
      } catch (e: any) {
        this.logger.error(`聚推客拉单失败 ${curStart.toISOString()} ~ ${curEnd.toISOString()}: ${e.message}`);
      }

      curStart = curEnd;
    }

    this.logger.log(`聚推客拉单完成: ${fetched} 笔，落库 ${upserted} 笔`);

    // 同步饿了么订单
    const eleResult = await this.syncEleOrdersRange(start, end);
    fetched += eleResult.fetched;
    upserted += eleResult.upserted;

    return { fetched, upserted };
  }

  private async syncEleOrdersRange(start: Date, end: Date): Promise<{ fetched: number; upserted: number }> {
    const p = this.ensureProvider();
    let fetched = 0;
    let upserted = 0;

    // 饿了么订单接口没说 1 小时限制，但保守点按小时拆段
    const HOUR = 3600_000;
    let curStart = new Date(start.getTime());

    while (curStart < end) {
      const curEnd = new Date(Math.min(curStart.getTime() + HOUR, end.getTime()));

      try {
        let page = 1;
        let lastPage = 1;
        do {
          const r = await p.fetchEleOrders({
            start: curStart,
            end: curEnd,
            page,
            pageSize: 100,
            queryType: 4, // 按更新时间
          });
          for (const order of r.list) {
            fetched++;
            try {
              await this.orderService.upsert(order);
              upserted++;
            } catch (e: any) {
              this.logger.error(`饿了么订单落库失败 ${order.platformOrderNo}: ${e.message}`);
            }
          }
          lastPage = r.lastPage;
          page++;
        } while (page <= lastPage);
      } catch (e: any) {
        this.logger.error(`饿了么拉单失败 ${curStart.toISOString()} ~ ${curEnd.toISOString()}: ${e.message}`);
      }

      curStart = curEnd;
    }

    if (fetched > 0) {
      this.logger.log(`饿了么拉单完成: ${fetched} 笔，落库 ${upserted} 笔`);
    }
    return { fetched, upserted };
  }
}
