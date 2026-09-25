import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CuratedGoods, CuratedStatus, GoodsTopic, Topic } from '@/entities';

/** 后台填什么都可能，slug 必须自己兜住：只留小写字母数字和连字符 */
function toSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

@Injectable()
export class TopicService implements OnModuleInit {
  private readonly logger = new Logger(TopicService.name);

  constructor(
    @InjectRepository(Topic) private readonly repo: Repository<Topic>,
    @InjectRepository(GoodsTopic) private readonly relRepo: Repository<GoodsTopic>,
    @InjectRepository(CuratedGoods) private readonly goodsRepo: Repository<CuratedGoods>,
  ) {}

  /** 首次启动把存量 groupKey 转成标签，老数据不丢 */
  async onModuleInit() {
    try {
      if (await this.repo.count()) return;
      await this.backfillFromGroupKey();
    } catch (e: any) {
      // 表还没建（DB_SYNC=false 且没跑过建表）时不该拖垮启动
      this.logger.warn(`专题回填跳过: ${e.message}`);
    }
  }

  /**
   * 把 curated_goods.groupKey 里的存量专题搬成 topic + 关联。
   *
   * groupKey 字段保留不动：一是回滚方便，二是老代码路径（/group/:key）
   * 还在用它，两套并存一段时间比一刀切安全。
   */
  private async backfillFromGroupKey() {
    const rows = await this.goodsRepo
      .createQueryBuilder('g')
      .select('g.groupKey', 'groupKey')
      .addSelect('COUNT(*)', 'n')
      .where("g.groupKey <> ''")
      .andWhere("g.groupKey <> 'default'")
      .groupBy('g.groupKey')
      .getRawMany();

    if (!rows.length) return;

    for (const [i, r] of rows.entries()) {
      const slug = toSlug(r.groupKey) || `g${i + 1}`;
      const t = await this.repo.save(this.repo.create({
        slug,
        name: r.groupKey,
        slot: i < 8 ? 'grid' : 'hidden',
        sortWeight: rows.length - i,
      }));
      const goods = await this.goodsRepo.find({
        where: { groupKey: r.groupKey },
        select: ['id'],
      });
      await this.relRepo.save(goods.map((g) => this.relRepo.create({
        curatedId: g.id, topicId: t.id,
      })));
      this.logger.log(`回填专题 ${r.groupKey} → /topic/${slug}（${goods.length} 件）`);
    }
  }

  // ───────────────────────── 读 ─────────────────────────

  private view(t: Topic, goodsCount?: number) {
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      icon: t.icon,
      bg: t.bg,
      cover: t.cover,
      intro: t.intro,
      slot: t.slot,
      sortWeight: t.sortWeight,
      status: t.status,
      /** 后台直接显示这个，运营不用猜 URL 填什么 */
      pageUrl: `/topic/${t.slug}`,
      ...(goodsCount === undefined ? {} : { goodsCount }),
    };
  }

  /** H5 用：只返上架的 */
  async listPublic() {
    const rows = await this.repo.find({
      where: { status: 1 },
      order: { sortWeight: 'DESC', id: 'ASC' },
    });
    return rows.map((t) => this.view(t));
  }

  /** 后台用：全都返，带每个专题挂了多少件 */
  async listAdmin() {
    const rows = await this.repo.find({ order: { sortWeight: 'DESC', id: 'ASC' } });
    if (!rows.length) return [];

    const counts = await this.relRepo
      .createQueryBuilder('r')
      .select('r.topicId', 'topicId')
      .addSelect('COUNT(*)', 'n')
      .where('r.topicId IN (:...ids)', { ids: rows.map((r) => r.id) })
      .groupBy('r.topicId')
      .getRawMany();
    const byId = new Map(counts.map((c) => [Number(c.topicId), Number(c.n)]));

    return rows.map((t) => this.view(t, byId.get(t.id) ?? 0));
  }

  async bySlug(slug: string) {
    const t = await this.repo.findOneBy({ slug });
    if (!t || t.status !== 1) throw new NotFoundException('专题不存在或已下架');
    return this.view(t);
  }

  /**
   * 数据库实体 → 前端认的形状。
   *
   * 这一步不能省：TypeORM 从 MySQL 取 decimal 回来是**字符串**，
   * 直接丢出去价格会变成 "29.90"，前端拿它做比较和计算就错了。
   * 字段口径也要跟榜单、搜索保持一致，卡片组件只认这一套。
   *
   * 注意这里**不算 rebate**（返利金额）——它要乘用户分成比例，
   * 而比例取决于「谁在看」，是 controller 那层的事。
   */
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
      compareGroupId: r.compareGroupId,
      curatedId: r.id,
    };
  }

  /**
   * 专题下的商品。
   *
   * sort 只给两个选项：返利最高 / 价格最低。
   * 不做筛选器——目标用户是不熟悉返利的县城用户，多一个控件就多一层
   * 「这是干什么的」，跟「简单明了」的定位相反。
   */
  async goods(slug: string, sort = 'rebate', page = 1, pageSize = 20) {
    const t = await this.repo.findOneBy({ slug });
    if (!t || t.status !== 1) throw new NotFoundException('专题不存在或已下架');

    const qb = this.goodsRepo
      .createQueryBuilder('g')
      .innerJoin(GoodsTopic, 'r', 'r.curatedId = g.id AND r.topicId = :tid', { tid: t.id })
      .where('g.status = :st', { st: CuratedStatus.ON });

    // 关联上的权重优先，这样同一件商品能在不同专题里排不同位置
    if (sort === 'price') qb.orderBy('r.sortWeight', 'DESC').addOrderBy('g.couponPrice', 'ASC');
    else qb.orderBy('r.sortWeight', 'DESC').addOrderBy('g.commission', 'DESC');
    qb.addOrderBy('g.id', 'DESC');

    const [rows, total] = await qb
      .skip((Math.max(page, 1) - 1) * pageSize)
      .take(Math.min(pageSize, 100))
      .getManyAndCount();

    return { total, page, topic: this.view(t), list: rows.map((r) => this.toGoods(r)) };
  }

  /** 某商品身上挂了哪些专题，后台编辑时要回显 */
  async ofGoods(curatedId: number): Promise<number[]> {
    const rows = await this.relRepo.find({ where: { curatedId }, select: ['topicId'] });
    return rows.map((r) => r.topicId);
  }

  /** 批量：给一串商品各自的标签，后台列表一次查完，别 N+1 */
  async ofGoodsBatch(ids: number[]): Promise<Map<number, number[]>> {
    const out = new Map<number, number[]>();
    if (!ids.length) return out;
    const rows = await this.relRepo.find({ where: { curatedId: In(ids) } });
    for (const r of rows) {
      const arr = out.get(r.curatedId) ?? [];
      arr.push(r.topicId);
      out.set(r.curatedId, arr);
    }
    return out;
  }

  // ───────────────────────── 写 ─────────────────────────

  async create(d: Partial<Topic> & { name: string }) {
    if (!d.name?.trim()) throw new BadRequestException('专题名不能为空');
    const slug = toSlug(d.slug || d.name);
    if (!slug) {
      throw new BadRequestException('slug 生成不出来，请手填英文短名，比如 baby');
    }
    if (await this.repo.findOneBy({ slug })) {
      throw new BadRequestException(`slug「${slug}」已存在，换一个`);
    }
    const t = await this.repo.save(this.repo.create({ ...d, slug }));
    this.logger.log(`新建专题 ${t.name} → /topic/${t.slug}`);
    return this.view(t, 0);
  }

  /**
   * 改专题。slug 一旦建好就不给改——改了等于换页面地址，
   * 之前分享出去的链接、后台别处填的 URL 全断掉。要换就新建一个。
   */
  async update(id: number, d: Partial<Topic>) {
    const t = await this.repo.findOneBy({ id });
    if (!t) throw new NotFoundException('专题不存在');
    delete (d as any).slug;
    delete (d as any).id;
    Object.assign(t, d);
    return this.view(await this.repo.save(t));
  }

  /**
   * 删专题：连带删关联，但**不动商品**。
   * 标签没了商品还在池子里，这是标签模型该有的行为——
   * 换成删商品那就成了误操作放大器。
   */
  async remove(id: number) {
    const t = await this.repo.findOneBy({ id });
    if (!t) throw new NotFoundException('专题不存在');
    const n = await this.relRepo.count({ where: { topicId: id } });
    await this.relRepo.delete({ topicId: id });
    await this.repo.delete({ id });
    this.logger.log(`删除专题 ${t.name}，解绑 ${n} 件商品（商品仍在选品池）`);
    return { ok: true, unlinked: n };
  }

  /**
   * 给商品设标签（整套替换，不是增量）。
   * 后台那边是多选框，提交的就是「最终应该有哪些」，
   * 用替换语义比 add/remove 两个接口少一半出错机会。
   */
  async setGoodsTopics(curatedId: number, topicIds: number[]) {
    const g = await this.goodsRepo.findOneBy({ id: curatedId });
    if (!g) throw new NotFoundException('商品不在选品池里');

    const wanted = [...new Set(topicIds.map(Number).filter((n) => n > 0))];
    if (wanted.length) {
      const found = await this.repo.countBy({ id: In(wanted) });
      if (found !== wanted.length) throw new BadRequestException('有专题不存在');
    }

    const now = await this.relRepo.find({ where: { curatedId } });
    const nowIds = now.map((r) => r.topicId);

    const toAdd = wanted.filter((t) => !nowIds.includes(t));
    const toDel = now.filter((r) => !wanted.includes(r.topicId)).map((r) => r.id);

    if (toDel.length) await this.relRepo.delete(toDel);
    if (toAdd.length) {
      await this.relRepo.save(toAdd.map((topicId) => this.relRepo.create({ curatedId, topicId })));
    }
    return { curatedId, topicIds: wanted };
  }

  /** 批量打标签：后台勾一批商品，一次都归到某个专题下 */
  async tagMany(topicId: number, curatedIds: number[]) {
    if (!(await this.repo.findOneBy({ id: topicId }))) {
      throw new NotFoundException('专题不存在');
    }
    const ids = [...new Set(curatedIds.map(Number).filter((n) => n > 0))];
    if (!ids.length) return { added: 0 };

    const exist = await this.relRepo.find({ where: { topicId, curatedId: In(ids) } });
    const has = new Set(exist.map((r) => r.curatedId));
    const add = ids.filter((i) => !has.has(i));
    if (add.length) {
      await this.relRepo.save(add.map((curatedId) => this.relRepo.create({ curatedId, topicId })));
    }
    return { added: add.length, skipped: ids.length - add.length };
  }

  /** 批量从专题里移出。后台在专题页里勾一批摘掉，用得上 */
  async untagMany(topicId: number, curatedIds: number[]) {
    const ids = [...new Set(curatedIds.map(Number).filter((n) => n > 0))];
    if (!ids.length) return { removed: 0 };
    const r = await this.relRepo.delete({ topicId, curatedId: In(ids) });
    return { removed: r.affected ?? 0 };
  }

  /** 商品从选品池删掉时顺手清关联，别留孤儿 */
  async unlinkGoods(curatedId: number) {
    await this.relRepo.delete({ curatedId });
  }
}
