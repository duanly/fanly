import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CuratedGoods, CuratedStatus, GoodsTopic } from '@/entities';
import { CpsService } from '../cps/cps.service';
import { UnifiedGoods } from '../cps/cps.types';

/** 刷新时每件商品之间的间隔，别把平台接口打限流了 */
const REFRESH_GAP_MS = 120;

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
      groupKey: r.groupKey,
      sortWeight: r.sortWeight,
      curatedId: r.id,
    };
  }

  /**
   * 加入选品池。已经在池里的就刷新快照并重新上架，
   * 这样运营重复点"加入"不会报错，也能顺手救回自动下架的商品。
   */
  async add(platform: string, goodsId: string, groupKey = 'default', sortWeight = 0) {
    const g = await this.cps.getGoodsDetail(platform, goodsId);
    if (!g) throw new BadRequestException('没查到这个商品，可能已下架或退出推广了');
    if (!(g.commission > 0)) {
      throw new BadRequestException('这个商品没有佣金，加进来用户点了也没返利');
    }

    const exist = await this.repo.findOneBy({ platform, goodsId });
    const row = this.repo.create({
      ...(exist ?? {}),
      ...this.snapshot(g),
      platform,
      goodsId,
      groupKey,
      sortWeight,
      status: CuratedStatus.ON,
      offReason: '',
      lastSyncAt: new Date(),
    });
    const saved = await this.repo.save(row);
    this.logger.log(`选品池 ${exist ? '更新' : '新增'}: ${platform}/${goodsId} ${g.title.slice(0, 20)}`);
    return this.toGoods(saved);
  }

  /** 后台列表：不过滤状态，下架的也要看得见 */
  async list(q: { groupKey?: string; status?: number; page?: number; pageSize?: number }) {
    const page = Math.max(q.page ?? 1, 1);
    const pageSize = Math.min(q.pageSize ?? 20, 100);
    const where: any = {};
    if (q.groupKey) where.groupKey = q.groupKey;
    if (q.status !== undefined && q.status !== null) where.status = q.status;

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { sortWeight: 'DESC', commission: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
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
    const where: any = { groupKey, status: CuratedStatus.ON };
    if (platform) where.platform = platform;
    const rows = await this.repo.find({
      where,
      order: { sortWeight: 'DESC', commission: 'DESC', id: 'DESC' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => this.toGoods(r));
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
}
