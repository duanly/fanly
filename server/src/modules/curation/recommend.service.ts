import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CuratedGoods, CuratedStatus, GoodsRecommend } from '@/entities';
import { SysConfigService } from '../admin/sys-config.service';

/**
 * 商品推荐（用户点赞）。
 *
 * 只允许推荐**选品池里的商品**——推荐指数存在 curated_goods 上，
 * 不在池里的商品没地方记分。这也顺带挡住了「推荐一件冷门商品把它刷上榜」。
 */
@Injectable()
export class RecommendService {
  private readonly logger = new Logger(RecommendService.name);

  constructor(
    @InjectRepository(GoodsRecommend) private readonly recRepo: Repository<GoodsRecommend>,
    @InjectRepository(CuratedGoods) private readonly goodsRepo: Repository<CuratedGoods>,
    private readonly ds: DataSource,
    private readonly cfg: SysConfigService,
  ) {}

  private limit() {
    return Math.max(1, this.cfg.num('goods.recommend_limit', 5));
  }

  /** 我对这批商品各推了几次，用来把按钮画成已推状态 */
  async mine(userId: number, items: { platform: string; goodsId: string }[]) {
    if (!userId || !items.length) return {};
    const rows = await this.recRepo.find({
      where: items.map((i) => ({ userId, platform: i.platform, goodsId: i.goodsId })),
    });
    return Object.fromEntries(rows.map((r) => [`${r.platform}:${r.goodsId}`, r.times]));
  }

  async recommend(userId: number, platform: string, goodsId: string) {
    const p = (platform || '').toUpperCase();
    if (!p || !goodsId) throw new BadRequestException('参数不全');

    const goods = await this.goodsRepo.findOneBy({ platform: p, goodsId });
    if (!goods) throw new BadRequestException('这个商品还没进选品池，暂时不能推荐');
    if (goods.status !== CuratedStatus.ON) throw new BadRequestException('商品已下架');

    const max = this.limit();

    return this.ds.transaction(async (m) => {
      let rec = await m.findOneBy(GoodsRecommend, { userId, platform: p, goodsId });
      if (rec && rec.times >= max) {
        throw new BadRequestException(`每件商品最多推荐 ${max} 次，你已经推满了`);
      }
      if (rec) {
        rec.times += 1;
        await m.save(GoodsRecommend, rec);
      } else {
        rec = await m.save(GoodsRecommend, m.create(GoodsRecommend, {
          userId, platform: p, goodsId, times: 1,
        }));
      }

      // 直接原子自增，别读出来加一再写回去——并发会丢票
      await m.increment(CuratedGoods, { id: goods.id }, 'recommendScore', 1);
      const fresh = await m.findOneBy(CuratedGoods, { id: goods.id });

      return {
        platform: p,
        goodsId,
        myTimes: rec.times,
        remain: max - rec.times,
        recommendScore: fresh?.recommendScore ?? 0,
        limit: max,
      };
    });
  }
}
