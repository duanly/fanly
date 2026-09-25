import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CpsOrder, CuratedGoods, CuratedStatus } from '@/entities';

/**
 * 首页的三个榜单。
 *
 * 热销榜用的是**我们自己的下单数据**，不是平台给的销量——
 * 平台销量是全站的，跟我们的用户没关系；自己的下单量才反映
 * 「这批人真的在买什么」，也是别人抄不走的东西。
 */
@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    @InjectRepository(CpsOrder) private readonly orderRepo: Repository<CpsOrder>,
    @InjectRepository(CuratedGoods) private readonly goodsRepo: Repository<CuratedGoods>,
  ) {}

  private toGoods(r: CuratedGoods) {
    return {
      platform: r.platform,
      goodsId: r.goodsId,
      title: r.title,
      image: r.image,
      shopName: r.shopName,
      price: Number(r.price),
      couponPrice: Number(r.couponPrice),
      couponAmount: Number(r.couponAmount),
      commissionRate: Number(r.commissionRate),
      commission: Number(r.commission),
      salesVolume: r.salesVolume,
      recommendScore: r.recommendScore,
    };
  }

  /**
   * 热销榜：近 N 天我们平台下单最多的商品，不够数就用选品池补齐。
   *
   * 为什么要补：冷启动阶段一单都没有，榜单空着是首页最难看的状态——
   * 用户第一次打开看到「暂无数据」，基本不会有第二次。
   *
   * 补位的规矩（很重要）：**补进来的商品不带 orderCount**。
   * 卡片上那个「N 人买过」只给真有订单的商品显示。让一件零销量的商品
   * 顶着「128 人买过」出现在首页，跟虚标价格是同一类事——一旦被发现，
   * 之后我们说什么用户都不信了。宁可少个角标，不能造个数。
   */
  async hot(days = 7, limit = 10) {
    const real = await this.hotFromOrders(days, limit);
    if (real.length >= limit) return real;

    // 已经上榜的不要重复出现
    const taken = new Set(real.map((g) => `${g.platform}:${g.goodsId}`));
    const need = limit - real.length;

    // 补位按平台销量降序：它至少代表「这东西在市面上卖得动」，
    // 比按佣金排靠谱——按佣金排会把高佣低销的冷门货堆到首页。
    const pool = await this.goodsRepo.find({
      where: { status: CuratedStatus.ON },
      order: { salesVolume: 'DESC', commission: 'DESC', id: 'DESC' },
      take: need + taken.size + 20,
    });

    const filler = [];
    for (const p of pool) {
      if (filler.length >= need) break;
      if (taken.has(`${p.platform}:${p.goodsId}`)) continue;
      filler.push(this.toGoods(p));   // 注意：不给 orderCount
    }

    if (filler.length) {
      this.logger.debug(`热销榜真实数据 ${real.length} 条，用选品池补 ${filler.length} 条`);
    }
    return [...real, ...filler];
  }

  /**
   * 榜单说明文案里那句「数据还少时用平台销量补齐」对应的就是上面那段。
   *
   * 订单表里只有下单时的快照（标题、图、实付），没有券后价和佣金，
   * 所以能在选品池里找到的就用池子里的新数据，找不到的用快照兜底——
   * 用户买过但我们没选进池的商品，同样值得展示。
   */
  private async hotFromOrders(days: number, limit: number) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.platform', 'platform')
      .addSelect('o.goodsId', 'goodsId')
      .addSelect('MAX(o.goodsTitle)', 'title')
      .addSelect('MAX(o.goodsImg)', 'image')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('AVG(o.payAmount)', 'avgPay')
      .where('o.orderTime >= :since', { since })
      .andWhere("o.goodsId <> ''")
      // 失效的订单不该把商品顶上榜
      .andWhere('o.orderStatus <> 4')
      .groupBy('o.platform')
      .addGroupBy('o.goodsId')
      .orderBy('orders', 'DESC')
      .limit(limit)
      .getRawMany();

    if (!rows.length) return [];

    const pool = await this.goodsRepo.find({
      where: rows.map((r) => ({ platform: r.platform, goodsId: r.goodsId })),
    });
    const byKey = new Map(pool.map((p) => [`${p.platform}:${p.goodsId}`, p]));

    return rows.map((r) => {
      const hit = byKey.get(`${r.platform}:${r.goodsId}`);
      const base = hit ? this.toGoods(hit) : {
        platform: r.platform,
        goodsId: r.goodsId,
        title: r.title || '',
        image: r.image || '',
        shopName: '',
        price: Math.round(Number(r.avgPay) * 100) / 100,
        couponPrice: Math.round(Number(r.avgPay) * 100) / 100,
        couponAmount: 0,
        commissionRate: 0,
        commission: 0,
        salesVolume: 0,
      };
      return { ...base, orderCount: Number(r.orders) };
    });
  }

  /** 返利榜：选品池里到手返利最高的（按佣金金额降序，等价于按返利降序） */
  async rebate(limit = 10) {
    const rows = await this.goodsRepo.find({
      where: { status: CuratedStatus.ON },
      order: { commission: 'DESC', id: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toGoods(r));
  }

  /**
   * 推荐榜：用户推荐次数优先，后台权重其次。
   *
   * 两条路都能上榜——用户一人一票投上来的，和运营手动置顶的。
   * 权重排在推荐后面，意味着运营想压一件商品上榜得给足权重，
   * 不能轻易盖掉真实的用户偏好。
   */
  async pick(limit = 10) {
    const rows = await this.goodsRepo.find({
      where: { status: CuratedStatus.ON },
      order: { recommendScore: 'DESC', sortWeight: 'DESC', id: 'DESC' },
      take: limit,
    });
    return rows.map((r) => ({ ...this.toGoods(r), recommendScore: r.recommendScore }));
  }
}
