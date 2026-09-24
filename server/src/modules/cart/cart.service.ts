import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from '@/entities';
import { CpsService } from '../cps/cps.service';

/** 一次最多刷这么多件，别为了一个购物车把平台接口打满 */
const REFRESH_LIMIT = 20;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(CartItem) private readonly repo: Repository<CartItem>,
    private readonly cps: CpsService,
  ) {}

  private toItem(r: CartItem) {
    const added = Number(r.addedPrice);
    const now = Number(r.couponPrice);
    return {
      id: r.id,
      platform: r.platform,
      goodsId: r.goodsId,
      title: r.title,
      image: r.image,
      addedPrice: added,
      couponPrice: now,
      commission: Number(r.commission),
      // 负数表示降价了，前端拿它打「降了 ¥X」的标
      priceDiff: Math.round((now - added) * 100) / 100,
      invalidReason: r.invalidReason,
      syncedAt: r.syncedAt,
      createdAt: r.createdAt,
    };
  }

  async add(userId: number, platform: string, goodsId: string) {
    const p = (platform || '').toUpperCase();
    if (!p || !goodsId) throw new BadRequestException('参数不全');

    const exist = await this.repo.findOneBy({ userId, platform: p, goodsId });
    if (exist) return { ...this.toItem(exist), already: true };

    const g = await this.cps.getGoodsDetail(p, goodsId);
    if (!g) throw new BadRequestException('没查到这个商品，可能已下架');

    const row = this.repo.create({
      userId, platform: p, goodsId,
      title: g.title,
      image: g.image,
      addedPrice: String(g.couponPrice),
      couponPrice: String(g.couponPrice),
      commission: String(g.commission),
      syncedAt: new Date(),
      invalidReason: '',
    });
    return { ...this.toItem(await this.repo.save(row)), already: false };
  }

  async list(userId: number) {
    const rows = await this.repo.find({ where: { userId }, order: { id: 'DESC' } });
    return rows.map((r) => this.toItem(r));
  }

  count(userId: number) {
    return this.repo.count({ where: { userId } });
  }

  async remove(userId: number, ids: number[]) {
    if (!ids?.length) return { deleted: 0 };
    const r = await this.repo.delete(ids.map((id) => ({ id, userId })));
    return { deleted: r.affected ?? 0 };
  }

  /**
   * 刷新购物车里的价格。
   * 前端先拿 list 秒出，再调这个在后台更新——
   * 别让用户对着转圈等平台接口。
   */
  async refresh(userId: number) {
    const rows = (await this.repo.find({ where: { userId }, order: { id: 'DESC' } }))
      .slice(0, REFRESH_LIMIT);

    await Promise.all(rows.map(async (r) => {
      try {
        const g = await this.cps.getGoodsDetail(r.platform, r.goodsId);
        if (!g) {
          r.invalidReason = '已下架';
        } else if (!(g.commission > 0)) {
          r.couponPrice = String(g.couponPrice);
          r.commission = '0';
          r.invalidReason = '暂无返利';
        } else {
          r.title = g.title || r.title;
          r.image = g.image || r.image;
          r.couponPrice = String(g.couponPrice);
          r.commission = String(g.commission);
          r.invalidReason = '';
        }
        r.syncedAt = new Date();
        await this.repo.save(r);
      } catch (e: any) {
        // 接口抽风不该把商品标成失效，保留原样下次再刷
        this.logger.warn(`刷新购物车 ${r.platform}/${r.goodsId} 失败: ${e.message}`);
      }
    }));

    return this.list(userId);
  }
}
