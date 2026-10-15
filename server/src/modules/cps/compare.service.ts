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

  /** 前台顶部导航用：有上架比价组的品类，以及各自多少组 */
  async categories() {
    const rows = await this.groupRepo
      .createQueryBuilder('g')
      .select('g.groupKey', 'key')
      .addSelect('COUNT(*)', 'total')
      .where('g.status = 1')
      .groupBy('g.groupKey')
      .getRawMany();
    return rows.map((r) => ({ key: r.key, total: Number(r.total) }));
  }

  /**
   * 关键词在比价组里搜。
   * 用户在比价页搜「奶粉」，要能搜到组名里带奶粉的组，
   * 也要能搜到成员商品标题里带奶粉的组——他记得的往往是商品名不是组名。
   */
  async search(keyword: string, limit = 20) {
    const k = (keyword || '').trim();
    if (!k) return [];

    const byName = await this.groupRepo
      .createQueryBuilder('g')
      .where('g.status = 1')
      .andWhere('g.name LIKE :k', { k: `%${k}%` })
      .take(limit)
      .getMany();

    const byMember = await this.goodsRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.compareGroupId', 'gid')
      .where('c.compareGroupId IS NOT NULL')
      .andWhere('c.title LIKE :k', { k: `%${k}%` })
      .take(limit)
      .getRawMany();

    const ids = new Set<number>([
      ...byName.map((g) => g.id),
      ...byMember.map((r) => Number(r.gid)).filter(Boolean),
    ]);
    if (!ids.size) return [];

    const groups = await this.groupRepo.find({
      where: { id: In([...ids]), status: 1 },
      order: { sortWeight: 'DESC', id: 'DESC' },
      take: limit,
    });
    const members = await this.goodsRepo.find({
      where: { compareGroupId: In(groups.map((g) => g.id)), status: CuratedStatus.ON },
    });
    return groups
      .map((g) => ({
        id: g.id, name: g.name, spec: g.spec, groupKey: g.groupKey, cover: g.cover,
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

  // ────────────── 自动匹配比价组 ──────────────

  /**
   * 营销/噪音词，提取关键词时去掉。
   * 这些词各平台都爱加，但对识别同款没用。
   */
  private readonly NOISE_WORDS = [
    '官方旗舰', '旗舰店', '官方', '正品', '包邮', '新款', '爆款', '热销',
    '推荐', '网红', '同款', '抖音', '快手', '小红书', '淘宝', '京东',
    '拼多多', '唯品会', '聚划算', '百亿补贴', '限时', '秒杀', '特惠',
    '促销', '打折', '降价', '清仓', '捡漏', '福利', '赠品', '送礼',
    '礼物', '男', '女', '学生', '大人', '儿童', '婴儿', '宝宝',
    '【', '】', '《', '》', '（', '）', '(', ')', '「', '」',
    '·', '•', '|', '丨', '/', '\\', '-', '_', '—',
  ];

  /**
   * 从标题里提取关键词（粗粒度分词 + 去噪）。
   * 不做精确分词，只要能识别出「品牌+型号+核心属性」就行。
   */
  private extractKeywords(title: string): string[] {
    if (!title) return [];
    let s = title;

    // 去掉噪音词
    for (const w of this.NOISE_WORDS) {
      s = s.split(w).join(' ');
    }

    // 提取：字母数字混合串（型号/规格）、2 字以上中文词
    const tokens: string[] = [];

    // 型号/规格：字母数字混合，至少 3 个字符
    const alnumRe = /[a-zA-Z0-9]+(?:[+\-][a-zA-Z0-9]+)*/g;
    const alnums = s.match(alnumRe) || [];
    for (const a of alnums) {
      if (a.length >= 3 && !/^\d+$/.test(a)) { // 纯数字的不算（可能是价格、年份）
        tokens.push(a.toLowerCase());
      }
    }

    // 中文：按 2-4 字切，简单粗暴但够用
    const chineseRe = /[一-龥]+/g;
    const chineseParts = s.match(chineseRe) || [];
    for (const part of chineseParts) {
      if (part.length >= 2) {
        // 整个短语作为一个关键词
        tokens.push(part);
        // 也切 2 字词，增加匹配命中
        for (let i = 0; i <= part.length - 2; i++) {
          const w = part.slice(i, i + 2);
          if (w.length === 2) tokens.push(w);
        }
      }
    }

    // 去重 + 过滤太短的
    return [...new Set(tokens.filter((t) => t.length >= 2))];
  }

  /**
   * 计算两个标题的相似度（Jaccard 系数：交集/并集）。
   * 型号关键词权重更高——型号对了基本就是同款。
   */
  private titleSimilarity(t1: string, t2: string): number {
    if (!t1 || !t2) return 0;
    const k1 = this.extractKeywords(t1);
    const k2 = this.extractKeywords(t2);
    if (!k1.length || !k2.length) return 0;

    const set1 = new Set(k1);
    const set2 = new Set(k2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    // 型号词加权：有共同字母数字串的加分
    const alnumRe = /[a-zA-Z0-9]/;
    const modelIntersection = [...intersection].filter((w) => alnumRe.test(w[0]));
    const modelBoost = modelIntersection.length * 0.1; // 每个共同型号词加 10%

    const base = intersection.size / union.size;
    return Math.min(1, base + modelBoost);
  }

  /**
   * 自动匹配比价组。
   *
   * 算法：
   * 1. 拉取所有上架的选品（至少有两个平台的商品才可能形成比价组）
   * 2. 两两计算标题相似度，阈值以上的放进同一组
   * 3. 组内至少两个不同平台的商品才有效
   * 4. 自动创建比价组，status=0（待审核），不影响前台
   *
   * @param opts.similarityThreshold 相似度阈值，默认 0.4
   * @param opts.maxGroups 最多创建多少组，防止一次性建太多
   * @param opts.onlyNew 只处理还不在任何比价组里的商品
   */
  async autoMatch(opts: {
    similarityThreshold?: number;
    maxGroups?: number;
    onlyNew?: boolean;
  } = {}): Promise<{
    scanned: number;
    created: number;
    skipped: number;
    groups: Array<{ name: string; items: Array<{ platform: string; title: string; curatedId: number }> }>;
  }> {
    const threshold = opts.similarityThreshold ?? 0.4;
    const maxGroups = opts.maxGroups ?? 50;
    const onlyNew = opts.onlyNew ?? true;

    // 拉取上架商品
    const where: any = { status: CuratedStatus.ON };
    if (onlyNew) where.compareGroupId = IsNull();
    const allGoods = await this.goodsRepo.find({
      where,
      select: ['id', 'platform', 'goodsId', 'title', 'image', 'compareGroupId'],
      order: { id: 'DESC' },
    });

    if (allGoods.length < 2) {
      return { scanned: allGoods.length, created: 0, skipped: 0, groups: [] };
    }

    // 按平台分组
    const byPlatform = new Map<string, typeof allGoods>();
    for (const g of allGoods) {
      if (!byPlatform.has(g.platform)) byPlatform.set(g.platform, []);
      byPlatform.get(g.platform)!.push(g);
    }
    const platforms = [...byPlatform.keys()];
    if (platforms.length < 2) {
      return { scanned: allGoods.length, created: 0, skipped: 0, groups: [] };
    }

    // 并查集/聚类：两两比较，相似度超过阈值的归为一组
    // 为了性能，只跨平台比（同平台的不会进同一个比价组）
    const n = allGoods.length;
    const parent = new Array(n).fill(0).map((_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    const union = (a: number, b: number) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    const idxMap = new Map(allGoods.map((g, i) => [g.id, i]));

    // 跨平台两两比较（O(n^2)，选品池几千件的话没问题）
    for (let i = 0; i < platforms.length; i++) {
      const listA = byPlatform.get(platforms[i])!;
      for (let j = i + 1; j < platforms.length; j++) {
        const listB = byPlatform.get(platforms[j])!;
        for (const a of listA) {
          for (const b of listB) {
            const sim = this.titleSimilarity(a.title, b.title);
            if (sim >= threshold) {
              const ai = idxMap.get(a.id)!;
              const bi = idxMap.get(b.id)!;
              union(ai, bi);
            }
          }
        }
      }
    }

    // 收集聚类结果
    const clusters = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root)!.push(i);
    }

    // 过滤：至少两个平台、至少 2 件商品
    const validClusters: Array<{ indices: number[]; platforms: Set<string> }> = [];
    for (const indices of clusters.values()) {
      if (indices.length < 2) continue;
      const plats = new Set(indices.map((i) => allGoods[i].platform));
      if (plats.size < 2) continue;
      // 一个平台在组里最多留一件（取第一个）
      const seen = new Set<string>();
      const filtered: number[] = [];
      for (const idx of indices) {
        const p = allGoods[idx].platform;
        if (!seen.has(p)) {
          seen.add(p);
          filtered.push(idx);
        }
      }
      if (filtered.length >= 2) {
        validClusters.push({ indices: filtered, platforms: plats });
      }
    }

    // 按组大小排序，先处理大的
    validClusters.sort((a, b) => b.indices.length - a.indices.length);

    // 自动创建比价组
    const created = [];
    let skipped = 0;

    for (let i = 0; i < Math.min(validClusters.length, maxGroups); i++) {
      const cluster = validClusters[i];
      const items = cluster.indices.map((idx) => allGoods[idx]);

      // 用第一个商品的标题（去掉营销词）作为组名
      const name = this.suggestGroupName(items[0].title, items);
      if (!name) { skipped++; continue; }

      try {
        // 检查是不是已经有类似的组了（避免重复创建）
        const existing = await this.groupRepo.findOne({
          where: { name },
          select: ['id'],
        });
        if (existing) { skipped++; continue; }

        // 创建比价组（status=0，待审核）
        const group = this.groupRepo.create({
          name,
          spec: '自动匹配，待审核确认规格',
          groupKey: 'default',
          cover: items[0].image,
          status: 0,
          sortWeight: 0,
        });
        const saved = await this.groupRepo.save(group);

        // 把商品加进组
        await this.goodsRepo.update(
          { id: In(items.map((it) => it.id)) },
          { compareGroupId: saved.id },
        );

        created.push({
          name,
          items: items.map((it) => ({
            platform: it.platform,
            title: it.title,
            curatedId: it.id,
          })),
        });
      } catch (e: any) {
        this.logger.warn(`自动匹配创建比价组失败 [${name}]: ${e.message}`);
        skipped++;
      }
    }

    this.logger.log(
      `自动匹配比价组完成：扫描 ${allGoods.length} 件，创建 ${created.length} 组，跳过 ${skipped} 组，阈值 ${threshold}`,
    );

    return {
      scanned: allGoods.length,
      created: created.length,
      skipped,
      groups: created,
    };
  }

  /**
   * 根据商品标题生成比价组名（取最有辨识度的部分）。
   * 规则：品牌名 + 核心型号/系列名，尽量短但能识别。
   */
  private suggestGroupName(title: string, items: CuratedGoods[]): string {
    if (!title) return '';

    // 简单处理：去掉营销词，取前 30 个字
    let name = title;
    for (const w of this.NOISE_WORDS) {
      name = name.split(w).join('');
    }
    name = name.replace(/\s+/g, '').trim();

    // 截到第一个标点或空格之前
    const firstPunc = name.search(/[，,。.！!？?~～\s]/);
    if (firstPunc > 5) name = name.slice(0, firstPunc);

    // 最长 30 字
    if (name.length > 30) name = name.slice(0, 30);
    if (name.length < 3) return '';

    return name;
  }
}
