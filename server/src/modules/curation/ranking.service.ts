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
   * 同平台同名商品去重。
   * 选品池里可能出现同款不同 goodsId 的情况（不同店铺、不同 sku），
   * 展示时去重，保留第一条（调用方自己先排好序）。
   * 跨平台的不去重——同款在不同平台都有是正常的，甚至是比价的基础。
   */
  private dedupByTitle<T extends { platform: string; title: string }>(list: T[]): T[] {
    const seen = new Set<string>();
    return list.filter((r) => {
      const key = `${r.platform}:${r.title.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
  async hot(days = 7, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    // 热销榜总量 = 真有订单的 + 选品池补位的，总数就是选品池上架数（上不封顶）
    const [, total] = await this.goodsRepo.findAndCount({ where: { status: CuratedStatus.ON } });

    // 真有订单的商品先全量取出来（一般不会很多，冷启动更少）
    const realRows = await this.hotFromOrdersAll(days);
    const realMap = new Map(realRows.map((r) => [`${r.platform}:${r.goodsId}`, r]));

    // 补位按平台销量降序
    const pool = await this.goodsRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: CuratedStatus.ON })
      .orderBy('g.salesVolume', 'DESC')
      .addOrderBy('CAST(g.commission AS DECIMAL)', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .take(pageSize + skip + 50) // 多取一点，防止前面全是真订单导致补位不够
      .getMany();

    // 合并：真订单的在前（按订单数降序），补位在后（按销量降序）
    const ordered: any[] = [...realRows];
    const seen = new Set(realRows.map((r) => `${r.platform}:${r.goodsId}`));
    for (const p of pool) {
      const key = `${p.platform}:${p.goodsId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(this.toGoods(p)); // 注意：不给 orderCount
    }

    // 同平台同名去重（同名商品保留排在前面的那个——真订单优先、销量高优先）
    const deduped = this.dedupByTitle(ordered);

    const list = deduped.slice(skip, skip + pageSize);
    if (list.length < deduped.length) {
      this.logger.debug(`热销榜第 ${page} 页：真实 ${realRows.length} 条，补位 ${deduped.length - realRows.length} 条`);
    }
    return {
      list,
      total,
      page,
      pageSize,
      hasMore: skip + list.length < total,
    };
  }

  /** 近 N 天所有有订单的商品（全量，不做分页——一般没多少） */
  private async hotFromOrdersAll(days: number) {
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
      .andWhere('o.orderStatus <> 4')
      .groupBy('o.platform')
      .addGroupBy('o.goodsId')
      .orderBy('orders', 'DESC')
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
  async rebate(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    // 先多取一些，去重后再按分页切
    const fetchSize = Math.min(pageSize * 3, 200);
    const rows = await this.goodsRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: CuratedStatus.ON })
      .orderBy('CAST(g.commission AS DECIMAL)', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .skip(0)
      .take(skip + fetchSize)
      .getMany();
    const deduped = this.dedupByTitle(rows);
    const total = await this.goodsRepo.count({ where: { status: CuratedStatus.ON } });
    const list = deduped.slice(skip, skip + pageSize);
    return {
      list: list.map((r) => this.toGoods(r)),
      total,
      page,
      pageSize,
      hasMore: skip + list.length < deduped.length,
    };
  }

  /**
   * 推荐榜：用户推荐次数优先，后台权重其次。
   *
   * 两条路都能上榜——用户一人一票投上来的，和运营手动置顶的。
   * 权重排在推荐后面，意味着运营想压一件商品上榜得给足权重，
   * 不能轻易盖掉真实的用户偏好。
   */
  async pick(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const fetchSize = Math.min(pageSize * 3, 200);
    const [allRows, total] = await this.goodsRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: CuratedStatus.ON })
      .orderBy('CAST(g.recommendScore AS INTEGER)', 'DESC')
      .addOrderBy('CAST(g.sortWeight AS INTEGER)', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .skip(0)
      .take(skip + fetchSize)
      .getManyAndCount();
    const deduped = this.dedupByTitle(allRows);
    const rows = deduped.slice(skip, skip + pageSize);
    return {
      list: rows.map((r) => ({ ...this.toGoods(r), recommendScore: r.recommendScore })),
      total,
      page,
      pageSize,
      hasMore: skip + rows.length < deduped.length,
    };
  }
}
