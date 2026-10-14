import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CuratedGoods, CuratedStatus, GoodsTopic } from '@/entities';
import { CpsService } from '../cps/cps.service';
import { UnifiedGoods } from '../cps/cps.types';

/** 刷新时每件商品之间的间隔，别把平台接口打限流了 */
const REFRESH_GAP_MS = 120;

function statusName(s: number) {
  return { 0: 'OFF', 1: 'ON', 2: 'EXPIRED', 3: 'PENDING' }[s] || String(s);
}

@Injectable()
export class CurationService {
  private readonly logger = new Logger(CurationService.name);

  constructor(
    @InjectRepository(CuratedGoods) private readonly repo: Repository<CuratedGoods>,
    @InjectRepository(GoodsTopic) private readonly relRepo: Repository<GoodsTopic>,
    private readonly cps: CpsService,
  ) {}

  /** UnifiedGoods → 表里的快照字段。decimal 列 TypeORM 用字符串，这里统一转 */
  private snapshot(g: UnifiedGoods) {
    return {
      title: g.title,
      image: g.image,
      images: JSON.stringify(g.images ?? []),
      shopName: g.shopName,
      price: String(g.price),
      couponPrice: String(g.couponPrice),
      couponAmount: String(g.couponAmount),
      commissionRate: String(g.commissionRate),
      commission: String(g.commission),
      salesVolume: Math.round(g.salesVolume || 0),
    };
  }

  /** 表行 → 前端要的形状，跟实时接口返回的字段保持一致 */
  private toGoods(r: CuratedGoods) {
    let images: string[] = [];
    try { images = JSON.parse(r.images || '[]'); } catch { /* ignore */ }
    return {
      platform: r.platform,
      goodsId: r.goodsId,
      title: r.title,
      image: r.image,
      images,
      shopName: r.shopName,
      price: Number(r.price),
      couponPrice: Number(r.couponPrice),
      couponAmount: Number(r.couponAmount),
      commissionRate: Number(r.commissionRate),
      commission: Number(r.commission),
      salesVolume: r.salesVolume,
      groupKey: r.groupKey,
      sortWeight: r.sortWeight,
      curatedId: r.id,
    };
  }

  /**
   * 加入待上架队列。已经在池里的就刷新快照并重新上架（不会降级）。
   */
  async add(platform: string, goodsId: string, groupKey = 'default', sortWeight = 0) {
    const g = await this.cps.getGoodsDetail(platform, goodsId);
    if (!g) throw new BadRequestException('没查到这个商品，可能已下架或退出推广了');
    if (!(g.commission > 0)) {
      throw new BadRequestException('这个商品没有佣金，加进来用户点了也没返利');
    }
    return this.upsert(g, groupKey, sortWeight, CuratedStatus.PENDING);
  }

  /**
   * 直接带商品数据入库，不查详情接口。
   *
   * 适用场景：京东等平台的详情接口没权限，但搜索/推荐接口能拿到完整数据。
   * 前端从搜索结果里把商品数据传过来，后端验证基本字段后直接入库。
   * 后续定时刷新会用真实数据覆盖，所以这里的数据临时用一下没问题。
   */
  async addWithGoods(body: {
    platform: string; goodsId: string; title: string; image: string;
    images?: string[];
    shopName?: string; price: number; couponPrice: number; couponAmount?: number;
    commissionRate: number; commission: number; salesVolume?: number;
    groupKey?: string; sortWeight?: number;
  }) {
    const { platform, goodsId, title, image, price, couponPrice, commission, commissionRate } = body;
    if (!platform || !goodsId || !title) {
      throw new BadRequestException('缺少必要字段：platform / goodsId / title');
    }
    if (!(commission > 0)) {
      throw new BadRequestException('这个商品没有佣金，加进来用户点了也没返利');
    }
    const g: UnifiedGoods = {
      platform,
      goodsId,
      title,
      image: image || '',
      images: body.images ?? [],
      shopName: body.shopName || '',
      price: Number(price),
      couponPrice: Number(couponPrice),
      couponAmount: Number(body.couponAmount ?? 0),
      commissionRate: Number(commissionRate),
      commission: Number(commission),
      salesVolume: Number(body.salesVolume ?? 0),
    };
    return this.upsert(g, body.groupKey || 'default', body.sortWeight ?? 0, CuratedStatus.PENDING);
  }

  /**
   * 把一件已经拿到的商品写进池子。
   * add() 走它、批量导入也走它——批量导入手里已经有完整商品对象，
   * 没理由再为每一件多打一次详情接口。
   *
   * targetStatus: 写入时的目标状态，默认 PENDING（进待上架队列等运营审核）。
   *   传 ON 就是直接上架。
   *   注意：如果商品已经在池里并且是 ON/OFF/EXPIRED，不会被降级成 PENDING——
   *   已上架的不能被自动拉品覆盖回待上架。
   */
  private async upsert(g: UnifiedGoods, groupKey: string, sortWeight: number, targetStatus = CuratedStatus.PENDING) {
    const exist = await this.repo.findOneBy({ platform: g.platform, goodsId: g.goodsId });
    // 已在池里（非 PENDING）的不降级；只有 PENDING 状态的会被刷新信息
    const finalStatus = exist && exist.status !== CuratedStatus.PENDING
      ? exist.status
      : targetStatus;
    const row = this.repo.create({
      ...(exist ?? {}),
      ...this.snapshot(g),
      platform: g.platform,
      goodsId: g.goodsId,
      groupKey,
      sortWeight,
      status: finalStatus,
      offReason: finalStatus === CuratedStatus.ON ? '' : (exist?.offReason ?? ''),
      lastSyncAt: new Date(),
    });
    const saved = await this.repo.save(row);
    this.logger.log(
      `选品池 ${exist ? '更新' : '新增'} [${statusName(finalStatus)}]: ${g.platform}/${g.goodsId} ${g.title.slice(0, 20)}`,
    );
    return this.toGoods(saved);
  }

  /**
   * 一键批量导入：把平台榜单/搜索多页商品拉下来、去重、有佣金的直接进池。
   *
   * 这是「上架到自己的平台」的主入口——之前后台只能一页一页挑（拼多多只给 40 条），
   * 现在一次能翻多页、多频道，凑够 count 为止。有佣金才算数，0 佣金的跳过（跳过的
   * 数要报给运营，让他知道平台里还有多少是没返利的）。
   *
   * targetStatus: 写入目标状态，默认 PENDING（进待上架队列）。传 ON 就是直接上架。
   */
  async importBatch(opts: {
    platform?: string;
    channel?: string;
    keyword?: string;
    count?: number;
    groupKey?: string;
    sortWeight?: number;
    targetStatus?: number;
    topicIds?: number[];
  }): Promise<{ fetched: number; added: number; skipped: number; errors: number }> {
    const platform = (opts.platform || 'PDD').toUpperCase();
    const target = Math.min(Math.max(opts.count ?? 100, 1), 500);
    const groupKey = opts.groupKey || 'default';
    const sortWeight = opts.sortWeight ?? 0;
    const targetStatus = opts.targetStatus ?? CuratedStatus.PENDING;
    const topicIds = (opts.topicIds ?? []).filter(Boolean);
    const MAX_PAGES = 10;

    const seen = new Set<string>();
    const candidates: UnifiedGoods[] = [];
    const collect = (list: UnifiedGoods[]) => {
      for (const g of list) {
        if (!g?.goodsId || seen.has(g.goodsId)) continue;
        seen.add(g.goodsId);
        candidates.push(g);
        if (candidates.length >= target) return true;
      }
      return false;
    };

    if (opts.keyword) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const r = await this.cps.searchGoodsPage(platform, {
          keyword: opts.keyword, page, pageSize: 100, sort: 'sales',
        });
        if (!r.list.length || collect(r.list) || !r.hasMore) break;
      }
    } else {
      // 榜单：多频道轮着翻。earn/hot/cheap 对应三个真正有区分的池子，
      // 每个池子翻到空或凑够为止。
      const channels = opts.channel ? [opts.channel] : ['earn', 'hot', 'cheap'];
      for (const ch of channels) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const r = await this.cps.recommendGoodsPage(platform, { channel: ch, page, pageSize: 100 });
          if (!r.list.length || collect(r.list) || !r.hasMore) break;
        }
        if (candidates.length >= target) break;
      }
      // 榜单凑不够，用销量搜索兜底（跟后台「全品类」一条路）
      if (candidates.length < target && !opts.channel) {
        try {
          for (let page = 1; page <= MAX_PAGES; page++) {
            const r = await this.cps.searchGoodsPage(platform, { page, pageSize: 100, sort: 'sales' });
            if (!r.list.length || collect(r.list) || !r.hasMore) break;
          }
        } catch (e: any) {
          this.logger.warn(`批量导入搜索兜底失败，只保留榜单结果: ${e.message}`);
        }
      }
    }

    // 淘宝物料精选接口列表不返回佣金，跳过校验——这些商品基本都有返利，
    // 后续自动刷新时用详情接口再验证，没佣金的会被自动下架。
    const needCommissionCheck = platform !== 'TB';
    const validCandidates = candidates.filter((g) => {
      if (needCommissionCheck && !(g.commission > 0)) return false;
      return true;
    });
    const skipped = candidates.length - validCandidates.length;

    // 一次查出所有已存在的，避免逐条查
    const existRows = validCandidates.length
      ? await this.repo.find({
          where: validCandidates.map((g) => ({ platform, goodsId: g.goodsId })),
          select: ['id', 'platform', 'goodsId', 'status'],
        })
      : [];
    const existMap = new Map(existRows.map((r) => [`${r.platform}:${r.goodsId}`, r]));

    const toInsert: Array<{ platform: string; goodsId: string } & ReturnType<CurationService['snapshot']> & {
      groupKey: string; sortWeight: number; status: number; offReason: string; lastSyncAt: Date;
    }> = [];
    const toUpdatePending: Array<{ id: number } & ReturnType<CurationService['snapshot']> & {
      groupKey: string; sortWeight: number; lastSyncAt: Date;
    }> = [];
    let skippedExisting = 0;

    for (const g of validCandidates) {
      const exist = existMap.get(`${platform}:${g.goodsId}`);
      const snap = this.snapshot(g);
      if (!exist) {
        // 全新的，直接插入
        toInsert.push({
          platform,
          goodsId: g.goodsId,
          ...snap,
          groupKey,
          sortWeight,
          status: targetStatus,
          offReason: targetStatus === CuratedStatus.ON ? '' : '',
          lastSyncAt: new Date(),
        });
      } else if (exist.status === CuratedStatus.PENDING) {
        // PENDING 状态的刷新信息，状态保持 PENDING（不降级也不升级）
        toUpdatePending.push({
          id: exist.id,
          ...snap,
          groupKey,
          sortWeight,
          lastSyncAt: new Date(),
        });
      } else {
        // 非 PENDING 的跳过（ON/OFF/EXPIRED 都不降级）
        skippedExisting++;
      }
    }

    let added = 0, errors = 0;

    // 批量插入新增的
    if (toInsert.length) {
      try {
        const BATCH = 200;
        for (let i = 0; i < toInsert.length; i += BATCH) {
          const chunk = toInsert.slice(i, i + BATCH);
          const result = await this.repo
            .createQueryBuilder()
            .insert()
            .into(CuratedGoods)
            .values(chunk)
            // 并发场景下的兜底：唯一键冲突就忽略（上面已经查过一次了）
            .orIgnore()
            .execute();
          added += result.identifiers?.length ?? chunk.length;
        }
        this.logger.log(`批量导入新增 ${added} 件 [${platform}]`);
      } catch (e: any) {
        this.logger.warn(`批量导入新增失败: ${e.message}`);
        errors += toInsert.length;
      }
    }

    // 批量更新 PENDING 状态的
    if (toUpdatePending.length) {
      try {
        const BATCH = 200;
        for (let i = 0; i < toUpdatePending.length; i += BATCH) {
          const chunk = toUpdatePending.slice(i, i + BATCH);
          // 用 CASE 批量更新，一次 SQL 搞定
          const ids = chunk.map((c) => c.id);
          const fields = Object.keys(chunk[0]).filter((k) => k !== 'id');
          const qb = this.repo.createQueryBuilder().update(CuratedGoods);
          for (const f of fields) {
            const whenClauses = chunk.map((c, idx) => `WHEN :id${idx} THEN :val${idx}_${f}`).join(' ');
            const params: Record<string, any> = {};
            chunk.forEach((c, idx) => {
              params[`id${idx}`] = c.id;
              params[`val${idx}_${f}`] = (c as any)[f];
            });
            qb.set({
              [f]: () => `CASE id ${whenClauses} END`,
            } as any);
            Object.assign((qb as any).expressionMap.setParameters, params);
          }
          await qb.whereInIds(ids).execute();
        }
        added += toUpdatePending.length;
        this.logger.log(`批量导入刷新 PENDING ${toUpdatePending.length} 件 [${platform}]`);
      } catch (e: any) {
        this.logger.warn(`批量导入刷新 PENDING 失败: ${e.message}`);
        errors += toUpdatePending.length;
      }
    }

    // 批量打标签
    if (topicIds.length && (toInsert.length || toUpdatePending.length)) {
      try {
        // 重新查一遍所有 affected 的 id（新增的 + 更新的）
        const allGoodsIds = [
          ...toInsert.map((c) => c.goodsId),
          ...toUpdatePending.map((c) => {
            const exist = existRows.find((r) => r.id === c.id);
            return exist?.goodsId ?? '';
          }),
        ].filter(Boolean);

        const allRows = await this.repo.find({
          where: allGoodsIds.map((gid) => ({ platform, goodsId: gid })),
          select: ['id'],
        });
        const allCuratedIds = allRows.map((r) => r.id);

        if (allCuratedIds.length) {
          // 查已有标签关联
          const existRels = await this.relRepo.find({
            where: topicIds.flatMap((tid) =>
              allCuratedIds.map((cid) => ({ curatedId: cid, topicId: tid })),
            ),
            select: ['curatedId', 'topicId'],
          });
          const existSet = new Set(existRels.map((r) => `${r.curatedId}:${r.topicId}`));

          // 批量插入新关联
          const newRels: Array<{ curatedId: number; topicId: number; sortWeight: number }> = [];
          for (const cid of allCuratedIds) {
            for (const tid of topicIds) {
              if (!existSet.has(`${cid}:${tid}`)) {
                newRels.push({ curatedId: cid, topicId: tid, sortWeight });
              }
            }
          }
          if (newRels.length) {
            const BATCH = 500;
            for (let i = 0; i < newRels.length; i += BATCH) {
              await this.relRepo
                .createQueryBuilder()
                .insert()
                .into(GoodsTopic)
                .values(newRels.slice(i, i + BATCH))
                .orIgnore()
                .execute();
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`批量导入打标签失败: ${e.message}`);
      }
    }

    return { fetched: candidates.length, added, skipped: skipped + skippedExisting, errors };
  }

  /**
   * 批量查询商品是否已在货架里（任何状态都算）。
   * 返回 map: "platform::goodsId" → { id, status }
   * 用于搜索结果页打「已上架」「待上架」等标记。
   */
  async existsBatch(items: Array<{ platform: string; goodsId: string }>): Promise<Record<string, { id: number; status: number }>> {
    if (!items?.length) return {};
    const result: Record<string, { id: number; status: number }> = {};
    // 分批查，避免 IN 太长
    const BATCH = 100;
    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      const qb = this.repo.createQueryBuilder('c')
        .where(
          `CONCAT(c.platform, '::', c.goodsId) IN (:...keys)`,
          { keys: chunk.map((x) => `${x.platform.toUpperCase()}::${x.goodsId}`) },
        )
        .select(['c.id', 'c.platform', 'c.goodsId', 'c.status']);
      const rows = await qb.getMany();
      for (const r of rows) {
        result[`${r.platform}::${r.goodsId}`] = { id: r.id, status: r.status };
      }
    }
    return result;
  }

  /** 后台列表：不过滤状态，下架的也要看得见 */
  async list(q: { groupKey?: string; topicId?: number; status?: number; page?: number; pageSize?: number }) {
    const page = Math.max(q.page ?? 1, 1);
    const pageSize = Math.min(q.pageSize ?? 20, 100);

    const qb = this.repo.createQueryBuilder('c');

    if (q.topicId) {
      qb.innerJoin('goods_topic', 'gt', 'gt.curatedId = c.id AND gt.topicId = :topicId', { topicId: q.topicId });
    }

    const where: any = {};
    if (q.groupKey) where.groupKey = q.groupKey;
    if (q.status !== undefined && q.status !== null) where.status = q.status;
    if (Object.keys(where).length) qb.where(where);

    qb.orderBy('c.sortWeight', 'DESC')
      .addOrderBy('c.commission', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      page,
      list: rows.map((r) => ({
        ...this.toGoods(r),
        status: r.status,
        offReason: r.offReason,
        lastSyncAt: r.lastSyncAt,
      })),
    };
  }

  /** 前台 feed：只给上架的。传了 platform 就按平台过滤，首页的平台切换靠它 */
  async feed(groupKey = 'default', limit = 20, platform?: string) {
    const rows = await this.feedPage({ groupKey, platform, page: 1, pageSize: limit });
    return rows.list;
  }

  /** 带分页的前台 feed，供 Group 页等需要滚动加载的场景用 */
  async feedPage(opts: {
    groupKey?: string;
    platform?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { groupKey = 'default', platform, page = 1, pageSize = 20 } = opts;
    const where: any = { groupKey, status: CuratedStatus.ON };
    if (platform) where.platform = platform;
    const skip = (page - 1) * pageSize;
    const take = Math.min(pageSize, 100);
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { sortWeight: 'DESC', commission: 'DESC', id: 'DESC' },
      skip,
      take,
    });
    return {
      list: rows.map((r) => this.toGoods(r)),
      total,
      page,
      pageSize: take,
      hasMore: skip + rows.length < total,
    };
  }

  /** 后台有哪些专题，顺带给出每个专题在架多少件 */
  async groups() {
    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.groupKey', 'groupKey')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN c.status = ${CuratedStatus.ON} THEN 1 ELSE 0 END)`, 'onShelf')
      .groupBy('c.groupKey')
      .getRawMany();
    return rows.map((r) => ({
      groupKey: r.groupKey,
      total: Number(r.total),
      onShelf: Number(r.onShelf),
    }));
  }

  async update(id: number, patch: { groupKey?: string; sortWeight?: number; status?: number }) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('选品不存在');
    if (patch.groupKey !== undefined) row.groupKey = patch.groupKey;
    if (patch.sortWeight !== undefined) row.sortWeight = patch.sortWeight;
    if (patch.status !== undefined) {
      row.status = patch.status;
      // 人工重新上架就把自动下架的原因清掉，免得界面上一直挂着旧提示
      if (patch.status === CuratedStatus.ON) row.offReason = '';
    }
    return this.toGoods(await this.repo.save(row));
  }

  async remove(id: number) {
    // 先清标签关联，不然商品没了关联还挂着，专题页会查出一堆空洞
    await this.relRepo.delete({ curatedId: id });
    const r = await this.repo.delete({ id });
    return { deleted: r.affected ?? 0 };
  }

  /** 一键移除所有已下架商品（人工下架 0 + 自动下架 2），连带清掉专题关联 */
  async removeOffShelf(): Promise<{ removed: number }> {
    const rows = await this.repo.find({
      where: { status: In([CuratedStatus.OFF, CuratedStatus.EXPIRED]) },
      select: ['id'],
    });
    const ids = rows.map((r) => r.id);
    if (!ids.length) return { removed: 0 };
    await this.relRepo.delete({ curatedId: In(ids) });
    const r = await this.repo.delete({ id: In(ids) });
    this.logger.log(`一键移除下架商品 ${r.affected ?? 0} 件`);
    return { removed: r.affected ?? 0 };
  }

  /**
   * 清理已下架超过 N 天的商品。
   * 只清 status=OFF(人工下架) 或 EXPIRED(自动下架)、且 updatedAt 在 days 天前的。
   * 刚下架的留着，方便运营后悔/恢复。
   */
  async cleanOffShelf(days = 30): Promise<{ removed: number }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.status IN (:...statuses)', { statuses: [CuratedStatus.OFF, CuratedStatus.EXPIRED] })
      .andWhere('c.updatedAt < :cutoff', { cutoff })
      .select(['c.id'])
      .getMany();
    const ids = rows.map((r) => r.id);
    if (!ids.length) return { removed: 0 };
    await this.relRepo.delete({ curatedId: In(ids) });
    const r = await this.repo.delete({ id: In(ids) });
    this.logger.log(`清理 ${days} 天前下架商品 ${r.affected ?? 0} 件`);
    return { removed: r.affected ?? 0 };
  }

  /** 刷单件：查不到或佣金归零就自动下架 */
  async refreshOne(row: CuratedGoods): Promise<'ok' | 'expired' | 'error'> {
    try {
      const g = await this.cps.getGoodsDetail(row.platform, row.goodsId);
      if (!g) {
        row.status = CuratedStatus.EXPIRED;
        row.offReason = '商品已下架或退出推广';
      } else if (!(g.commission > 0)) {
        Object.assign(row, this.snapshot(g));
        row.status = CuratedStatus.EXPIRED;
        row.offReason = '佣金归零';
      } else {
        Object.assign(row, this.snapshot(g));
        // 之前是自动下架的，现在又有佣金了就自动救回来；人工下架的不动
        if (row.status === CuratedStatus.EXPIRED) {
          row.status = CuratedStatus.ON;
          row.offReason = '';
        }
      }
      row.lastSyncAt = new Date();
      await this.repo.save(row);
      return row.status === CuratedStatus.EXPIRED ? 'expired' : 'ok';
    } catch (e: any) {
      // 接口抽风不该把商品下架，下次再刷
      this.logger.warn(`刷新 ${row.platform}/${row.goodsId} 失败: ${e.message}`);
      return 'error';
    }
  }

  /**
   * 全池刷新。串行 + 间隔，宁可慢也别把平台接口打限流——
   * 限流了连用户的实时搜索一起挂，得不偿失。
   */
  async refreshAll(): Promise<{ total: number; ok: number; expired: number; error: number }> {
    const rows = await this.repo.find({
      where: [{ status: CuratedStatus.ON }, { status: CuratedStatus.EXPIRED }],
    });
    const stat = { total: rows.length, ok: 0, expired: 0, error: 0 };
    for (const row of rows) {
      stat[await this.refreshOne(row)] += 1;
      if (REFRESH_GAP_MS) await new Promise((r) => setTimeout(r, REFRESH_GAP_MS));
    }
    return stat;
  }

  /**
   * 只刷比价组里的商品。
   * 比价页上价格过期是最伤信任的事，这批值得比普通选品刷得勤。
   */
  async refreshCompareMembers(rows: CuratedGoods[]) {
    const stat = { total: rows.length, ok: 0, expired: 0, error: 0 };
    for (const row of rows) {
      stat[await this.refreshOne(row)] += 1;
      if (REFRESH_GAP_MS) await new Promise((r) => setTimeout(r, REFRESH_GAP_MS));
    }
    return stat;
  }

  async refreshById(id: number) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('选品不存在');
    const r = await this.refreshOne(row);
    return { result: r, goods: this.toGoods(row), status: row.status, offReason: row.offReason };
  }

  /**
   * 自动拉品：从各平台批量拉商品，以待选品（PENDING）状态入库。
   *
   * 策略：每个平台从三个维度混合拉——热销榜 + 收益榜 + 大品类关键词搜索，
   * 凑够 targetCount 就停。拉回来都是 PENDING，运营在选品工作台审核后上架。
   *
   * 已在池里（ON/OFF/EXPIRED）的跳过，不会被覆盖成 PENDING；
   * 已经是 PENDING 的会刷新信息（价格、佣金、销量更新到最新）。
   */
  async autoPull(opts: {
    platforms?: string[];
    targetPerPlatform?: number;
    keywords?: string[];
  }): Promise<Record<string, { fetched: number; added: number; skipped: number; errors: number }>> {
    const platforms = opts.platforms?.length ? opts.platforms : ['PDD', 'JD', 'TB', 'DY'];
    const target = Math.min(Math.max(opts.targetPerPlatform ?? 1000, 100), 5000);
    const keywords = opts.keywords?.length ? opts.keywords : ['日用', '食品', '美妆', '数码', '服饰'];

    const result: Record<string, { fetched: number; added: number; skipped: number; errors: number }> = {};

    for (const platform of platforms) {
      this.logger.log(`自动拉品开始 [${platform}], 目标 ${target} 件`);
      const stat = { fetched: 0, added: 0, skipped: 0, errors: 0 };
      const seen = new Set<string>();
      const candidates: UnifiedGoods[] = [];
      const collect = (list: UnifiedGoods[]) => {
        for (const g of list) {
          if (!g?.goodsId || seen.has(g.goodsId)) continue;
          seen.add(g.goodsId);
          candidates.push(g);
          if (candidates.length >= target) return true;
        }
        return false;
      };

      // 维度 1：热销榜（25% 配额）
      try {
        const hotTarget = Math.floor(target * 0.25);
        for (let page = 1; page <= 20 && candidates.length < hotTarget; page++) {
          const r = await this.cps.recommendGoodsPage(platform, { channel: 'hot', page, pageSize: 50 });
          if (!r.list.length || !r.hasMore) break;
          if (collect(r.list)) break;
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (e: any) {
        this.logger.warn(`自动拉品 [${platform}] 热销榜失败: ${e.message}`);
      }

      // 维度 2：收益榜（25% 配额）
      try {
        const earnTarget = Math.floor(target * 0.5);
        for (let page = 1; page <= 20 && candidates.length < earnTarget; page++) {
          const r = await this.cps.recommendGoodsPage(platform, { channel: 'earn', page, pageSize: 50 });
          if (!r.list.length || !r.hasMore) break;
          if (collect(r.list)) break;
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (e: any) {
        this.logger.warn(`自动拉品 [${platform}] 收益榜失败: ${e.message}`);
      }

      // 维度 3：关键词搜索（每个关键词分一点配额，总共 50% 配额）
      const kwTarget = Math.floor(target * 0.5);
      const kwQuota = Math.ceil(kwTarget / keywords.length);
      for (const kw of keywords) {
        if (candidates.length >= target) break;
        const beforeCount = candidates.length;
        try {
          for (let page = 1; page <= 5; page++) {
            const r = await this.cps.searchGoodsPage(platform, { keyword: kw, page, pageSize: 50, sort: 'sales' });
            if (!r.list.length || !r.hasMore) break;
            if (collect(r.list)) break;
            // 这个关键词已经拉够配额了就停
            if (candidates.length - beforeCount >= kwQuota) break;
            await new Promise((r) => setTimeout(r, 200));
          }
        } catch (e: any) {
          this.logger.warn(`自动拉品 [${platform}] 关键词[${kw}]失败: ${e.message}`);
        }
      }

      // 写入库（PENDING 状态）
      for (const g of candidates) {
        stat.fetched++;
        if (!(g.commission > 0)) { stat.skipped++; continue; }
        try {
          await this.upsert(g, 'default', 0, CuratedStatus.PENDING);
          stat.added++;
        } catch (e: any) {
          stat.errors++;
          this.logger.warn(`自动拉品入库失败 ${platform}/${g.goodsId}: ${e.message}`);
        }
      }

      result[platform] = stat;
      this.logger.log(`自动拉品完成 [${platform}]: 拉取 ${stat.fetched}, 入库 ${stat.added}, 跳过 ${stat.skipped}, 错误 ${stat.errors}`);
    }

    return result;
  }
}
