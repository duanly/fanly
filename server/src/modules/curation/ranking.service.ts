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

  /** 简单内存缓存：key → { value, expireAt }，榜单变化不快，缓存 3 分钟够了 */
  private cache = new Map<string, { value: any; expireAt: number }>();
  private readonly CACHE_TTL_MS = 3 * 60 * 1000; // 3 分钟

  constructor(
    @InjectRepository(CpsOrder) private readonly orderRepo: Repository<CpsOrder>,
    @InjectRepository(CuratedGoods) private readonly goodsRepo: Repository<CuratedGoods>,
  ) {}

  private getCache<T>(key: string): T | undefined {
    const hit = this.cache.get(key);
    if (hit && hit.expireAt > Date.now()) return hit.value as T;
    return undefined;
  }

  private setCache(key: string, value: any) {
    this.cache.set(key, { value, expireAt: Date.now() + this.CACHE_TTL_MS });
  }

  /** 运营改了选品后主动清缓存，让用户立刻看到新的 */
  clearCache() {
    this.cache.clear();
    this.logger.debug('排行榜缓存已清空');
  }

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
   * 平台均衡：轮询穿插，避免单一平台霸榜。
   *
   * 思路：把商品按平台分组，每组保持原有排序（每组内部仍是最优质的在前），
   * 然后按 round-robin 的方式从每组依次取一个，拼回一个列表。
   * 这样首页翻几屏下来，每个平台的商品都能看到，不会被某一家淹没。
   *
   * 注意：这是"展示层面的重排"，不改变每组内部的相对顺序——
   * 热销榜里销量最高的 PDD 商品仍然在 PDD 组第一位，只是它前面
   * 可能插了一个 JD 第一名、一个 TB 第一名。
   */
  private balancePlatforms<T extends { platform: string }>(list: T[]): T[] {
    if (list.length <= 1) return list;

    // 按平台分组，保持原顺序
    const groups = new Map<string, T[]>();
    for (const item of list) {
      if (!groups.has(item.platform)) groups.set(item.platform, []);
      groups.get(item.platform)!.push(item);
    }

    // 只有一个平台就不用排了
    if (groups.size <= 1) return list;

    // 轮询穿插
    const result: T[] = [];
    const queues = Array.from(groups.values());
    let maxLen = Math.max(...queues.map((q) => q.length));

    for (let i = 0; i < maxLen; i++) {
      for (const q of queues) {
        if (i < q.length) result.push(q[i]);
      }
    }

    return result;
  }

  /**
   * 分档均衡：先按数值分档（高/中/低...），每档内部做平台均衡，
   * 再把各档拼回来。这样整体还是从高到低，但每一档内各平台都能露脸。
   *
   * 适用于返利榜、销量榜这类"排序是核心诉求"的榜单——
   * 不能为了平台均衡把低返利的插到高返利前面，那就本末倒置了。
   *
   * @param list 已排好序的商品列表
   * @param getValue 取排序值的函数（如佣金、销量）
   * @param tiers 分档阈值，从高到低，如 [10, 5, 1] 表示 >=10 一档，5-10 一档，1-5 一档，<1 一档
   */
  private balancePlatformsTiered<T extends { platform: string }>(
    list: T[],
    getValue: (item: T) => number,
    tiers: number[],
  ): T[] {
    if (list.length <= 1) return list;

    // 分档：每档是 [min, max)
    const groups: T[][] = [];
    // 第一档：最高档
    let remaining = [...list];
    for (const threshold of tiers) {
      const above: T[] = [];
      const rest: T[] = [];
      for (const item of remaining) {
        if (getValue(item) >= threshold) above.push(item);
        else rest.push(item);
      }
      groups.push(above);
      remaining = rest;
    }
    // 最后一档：低于最低阈值的
    if (remaining.length) groups.push(remaining);

    // 每档内部做平台均衡，然后按档拼回
    const result: T[] = [];
    for (const g of groups) {
      if (g.length) result.push(...this.balancePlatforms(g));
    }
    return result;
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
    const cacheKey = `hot|${days}|${page}|${pageSize}`;
    const cached = this.getCache<any>(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * pageSize;

    // 热销榜总量 = 真有订单的 + 选品池补位的，总数就是选品池上架数（上不封顶）
    const [, total] = await this.goodsRepo.findAndCount({ where: { status: CuratedStatus.ON } });

    // 真有订单的商品先全量取出来（一般不会很多，冷启动更少）
    const realRows = await this.hotFromOrdersAll(days);
    const realMap = new Map(realRows.map((r) => [`${r.platform}:${r.goodsId}`, r]));

    // 补位按平台销量降序，多取一些做去重+均衡后的分页
    const pool = await this.goodsRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: CuratedStatus.ON })
      .orderBy('g.salesVolume', 'DESC')
      .addOrderBy('g.commission', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .take(Math.max(skip + pageSize + 50, 300)) // 至少取 300 条，保证翻几页还有数据
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

    // 分档均衡：按订单数分档，每档内各平台穿插
    // 档位：≥5单 / ≥3单 / ≥2单 / ≥1单 / 0单补位
    const balanced = this.balancePlatformsTiered(
      deduped,
      (g: any) => Number(g.orderCount) || 0,
      [5, 3, 2, 1],
    );

    const list = balanced.slice(skip, skip + pageSize);
    if (list.length < balanced.length) {
      this.logger.debug(`热销榜第 ${page} 页：真实 ${realRows.length} 条，补位 ${balanced.length - realRows.length} 条`);
    }
    const result = {
      list,
      total,
      page,
      pageSize,
      hasMore: skip + list.length < balanced.length,
    };
    this.setCache(cacheKey, result);
    return result;
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

  /**
   * 返利榜：选品池里到手返利最高的。
   *
   * 两种排序：
   * - amount（默认）按佣金绝对金额降序 —— 买到手能省的钱最多
   * - rate 按返佣比例降序 —— 高比例商品下架也快，不给曝光就永远没机会被买走
   */
  async rebate(page = 1, pageSize = 20, sortBy: 'amount' | 'rate' = 'amount') {
    const cacheKey = `rebate|${sortBy}|${page}|${pageSize}`;
    const cached = this.getCache<any>(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * pageSize;
    // 先多取一些，去重 + 分档均衡后再按分页切。至少 400 条，让用户能翻到足够多的内容
    const fetchSize = Math.max(pageSize * 10, 400);
    const byRate = sortBy === 'rate';
    const rows = await this.goodsRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: CuratedStatus.ON })
      .orderBy(byRate ? 'g.commissionRate' : 'g.commission', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .skip(0)
      .take(skip + fetchSize)
      .getMany();
    const deduped = this.dedupByTitle(rows);
    // 分档均衡，每档内各平台穿插
    // 按金额：≥20元 / ≥10元 / ≥5元 / ≥2元
    // 按比例：≥50% / ≥30% / ≥20% / ≥10%
    const balanced = this.balancePlatformsTiered(
      deduped,
      byRate ? (g) => Number(g.commissionRate) : (g) => Number(g.commission),
      byRate ? [0.5, 0.3, 0.2, 0.1] : [20, 10, 5, 2],
    );
    const total = await this.goodsRepo.count({ where: { status: CuratedStatus.ON } });
    const list = balanced.slice(skip, skip + pageSize);
    const result = {
      list: list.map((r) => this.toGoods(r)),
      total,
      page,
      pageSize,
      hasMore: skip + list.length < balanced.length,
    };
    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * 推荐榜：用户推荐次数优先，后台权重其次。
   *
   * 两条路都能上榜——用户一人一票投上来的，和运营手动置顶的。
   * 权重排在推荐后面，意味着运营想压一件商品上榜得给足权重，
   * 不能轻易盖掉真实的用户偏好。
   */
  async pick(page = 1, pageSize = 20) {
    const cacheKey = `pick|${page}|${pageSize}`;
    const cached = this.getCache<any>(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * pageSize;
    const fetchSize = Math.max(pageSize * 8, 300);
    const [allRows, total] = await this.goodsRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: CuratedStatus.ON })
      .orderBy('g.recommendScore', 'DESC')
      .addOrderBy('g.sortWeight', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .skip(0)
      .take(skip + fetchSize)
      .getManyAndCount();
    const deduped = this.dedupByTitle(allRows);
    // 分档均衡：按推荐分档，每档内各平台穿插
    // 档位：≥10票 / ≥5票 / ≥1票 / 0票
    const balanced = this.balancePlatformsTiered(
      deduped,
      (g) => Number(g.recommendScore) + Number(g.sortWeight),
      [10, 5, 1],
    );
    const rows = balanced.slice(skip, skip + pageSize);
    const result = {
      list: rows.map((r) => ({ ...this.toGoods(r), recommendScore: r.recommendScore })),
      total,
      page,
      pageSize,
      hasMore: skip + rows.length < balanced.length,
    };
    this.setCache(cacheKey, result);
    return result;
  }
}
