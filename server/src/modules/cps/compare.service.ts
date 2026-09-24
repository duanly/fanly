import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { CompareGroup, CuratedGoods, CuratedStatus } from '@/entities';

@Injectable()
export class CompareService {
  private readonly logger = new Logger(CompareService.name);

  constructor(
    @InjectRepository(CompareGroup) private readonly groupRepo: Repository<CompareGroup>,
    @InjectRepository(CuratedGoods) private readonly goodsRepo: Repository<CuratedGoods>,
  ) {}

  private toGoods(r: CuratedGoods) {
    return {
      curatedId: r.id,
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
      status: r.status,
      lastSyncAt: r.lastSyncAt,
    };
  }

  async createOrUpdate(body: {
    id?: number; name: string; spec?: string; groupKey?: string;
    cover?: string; sortWeight?: number; status?: number;
  }) {
    if (!body.name?.trim()) throw new BadRequestException('比价组要有名字，写清型号规格');
    const row = body.id
      ? await this.groupRepo.findOneBy({ id: body.id })
      : this.groupRepo.create();
    if (!row) throw new NotFoundException('比价组不存在');

    row.name = body.name.trim();
    if (body.spec !== undefined) row.spec = body.spec;
    if (body.groupKey !== undefined) row.groupKey = body.groupKey || 'default';
    if (body.cover !== undefined) row.cover = body.cover;
    if (body.sortWeight !== undefined) row.sortWeight = body.sortWeight;
    if (body.status !== undefined) row.status = body.status;
    return this.groupRepo.save(row);
  }

  async remove(id: number) {
    // 先把成员摘出来，商品本身留在选品池里，只是不再属于任何比价组
    await this.goodsRepo.update({ compareGroupId: id }, { compareGroupId: null });
    const r = await this.groupRepo.delete({ id });
    return { deleted: r.affected ?? 0 };
  }

  /**
   * 往组里加成员。
   * 一个平台在一个组里只留一件——同平台两件同款没有比价意义，
   * 真要比不同规格，那就是另一个组。
   */
  async addMembers(groupId: number, curatedIds: number[]) {
    const group = await this.groupRepo.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException('比价组不存在');

    const rows = await this.goodsRepo.find({ where: { id: In(curatedIds) } });
    const existing = await this.goodsRepo.find({ where: { compareGroupId: groupId } });
    const takenPlatforms = new Set(existing.map((e) => e.platform));

    const added: number[] = [];
    const skipped: { id: number; reason: string }[] = [];
    for (const r of rows) {
      if (r.compareGroupId === groupId) continue;
      if (takenPlatforms.has(r.platform)) {
        skipped.push({ id: r.id, reason: `${r.platform} 在这个组里已经有一件了` });
        continue;
      }
      r.compareGroupId = groupId;
      takenPlatforms.add(r.platform);
      added.push(r.id);
    }
    if (added.length) await this.goodsRepo.save(rows.filter((r) => added.includes(r.id)));

    // 组还没封面就拿第一个成员的图顶上
    if (!group.cover && rows.length) {
      group.cover = rows[0].image;
      await this.groupRepo.save(group);
    }
    return { added: added.length, skipped };
  }

  async removeMember(groupId: number, curatedId: number) {
    await this.goodsRepo.update({ id: curatedId, compareGroupId: groupId }, { compareGroupId: null });
    return { ok: true };
  }

  /** 后台列表：不过滤状态 */
  async adminList(groupKey?: string, page = 1, size = 20) {
    const where: any = {};
    if (groupKey) where.groupKey = groupKey;
    const [rows, total] = await this.groupRepo.findAndCount({
      where,
      order: { sortWeight: 'DESC', id: 'DESC' },
      skip: (page - 1) * size, take: size,
    });
    const ids = rows.map((r) => r.id);
    const members = ids.length
      ? await this.goodsRepo.find({ where: { compareGroupId: In(ids) } })
      : [];
    return {
      total, page,
      list: rows.map((g) => ({
        ...g,
        members: members.filter((m) => m.compareGroupId === g.id).map((m) => this.toGoods(m)),
      })),
    };
  }

  /** 前台列表：只给上架、且至少两个平台的组——一个平台没法比价 */
  async publicList(groupKey?: string, limit = 20) {
    const where: any = { status: 1 };
    if (groupKey) where.groupKey = groupKey;
    const rows = await this.groupRepo.find({
      where, order: { sortWeight: 'DESC', id: 'DESC' }, take: Math.min(limit, 50),
    });
    if (!rows.length) return [];

    const members = await this.goodsRepo.find({
      where: { compareGroupId: In(rows.map((r) => r.id)), status: CuratedStatus.ON },
    });
    return rows
      .map((g) => ({
        id: g.id,
        name: g.name,
        spec: g.spec,
        groupKey: g.groupKey,
        cover: g.cover,
        items: members.filter((m) => m.compareGroupId === g.id).map((m) => this.toGoods(m)),
      }))
      .filter((g) => g.items.length >= 2);
  }

  async detail(id: number) {
    const g = await this.groupRepo.findOneBy({ id });
    if (!g) throw new NotFoundException('比价组不存在');
    const members = await this.goodsRepo.find({
      where: { compareGroupId: id, status: CuratedStatus.ON },
    });
    return {
      id: g.id, name: g.name, spec: g.spec, groupKey: g.groupKey, cover: g.cover,
      items: members.map((m) => this.toGoods(m)),
    };
  }

  /** 比价组的成员要刷得比普通选品勤——价格过期是比价页最大的信任杀手 */
  async members() {
    return this.goodsRepo.find({
      where: { compareGroupId: Not(IsNull()), status: CuratedStatus.ON },
    });
  }
}
