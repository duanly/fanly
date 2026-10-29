import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CuratedGoods, CuratedStatus, GoodsTopic, Topic } from '@/entities';

/**
 * 品牌词集合：命中标题就自动打"品牌·XXX"标签。
 * 复用比价组自动匹配里的品牌词思路。
 */
const BRAND_WORDS = new Set([
  // 母婴
  '飞鹤', '伊利', '蒙牛', '君乐宝', '完达山', '合生元', '美赞臣', '惠氏',
  '雅培', '雀巢', '爱他美', '美素佳儿', '帮宝适', '好奇', '妈咪宝贝',
  '安儿乐', '大王', '花王', '尤妮佳', '贝亲', '好孩子',
  // 美妆
  '欧莱雅', '玉兰油', '雅诗兰黛', '兰蔻', '资生堂', '迪奥', '香奈儿',
  '纪梵希', '圣罗兰', '阿玛尼', '完美日记', '花西子',
  '百雀羚', '自然堂', '珀莱雅', '丸美', '韩束', '一叶子', '御泥坊',
  // 数码
  '华为', '小米', '苹果', '荣耀', '一加',
  '三星', '索尼', '联想', '戴尔', '惠普', '华硕', '宏碁',
  '漫步者', 'bose', 'jbl',
  // 家电
  '美的', '格力', '海尔', '海信', 'tcl', '创维', '康佳', '长虹',
  '苏泊尔', '九阳', '小熊', '飞利浦', '松下', '博世', '西门子',
  '老板', '方太', '华帝', '万家乐', '万和', '林内', '能率',
  // 食品
  '三只松鼠', '良品铺子', '百草味', '卫龙', '周黑鸭', '绝味', '洽洽',
  '旺旺', '喜之郎', '乐事', '奥利奥', '统一', '康师傅', '白象',
  '农夫山泉', '怡宝', '百岁山', '脉动', '红牛', '东鹏特饮', '元气森林',
  '瑞幸', '星巴克',
  // 服饰鞋包
  '耐克', '阿迪达斯', '李宁', '安踏', '特步', '361度',
  '鸿星尔克', '回力', '飞跃', '优衣库',
  '森马', '美特斯邦威', '太平鸟', '波司登', '雅戈尔', '七匹狼', '海澜之家',
  '新秀丽',
  // 个护
  '海飞丝', '飘柔', '潘婷', '沙宣', '清扬', '多芬', '力士', '舒肤佳',
  '六神', '隆力奇', '大宝', '相宜本草', '佰草集', '高夫', '妮维雅',
  '云南白药', '高露洁', '佳洁士', '舒适达',
  // 家居日用
  '维达', '心相印', '清风', '洁柔',
  '蓝月亮', '立白', '雕牌', '超能', '奥妙', '汰渍', '碧浪',
  '爱仕达', '双立人',
  // 珠宝首饰
  '周大福', '周生生', '老凤祥', '六福珠宝', '中国黄金', '老庙黄金',
  '施华洛世奇', '潘多拉',
  // 运动户外
  '北面', '哥伦比亚', '探路者', '骆驼', '迪卡侬',
]);

/**
 * 自动打标：根据商品标题关键词 + 品牌词识别，自动给商品打标签。
 *
 * 设计原则：
 *   - 只追加，不覆盖：人工打过的标签不动，只加新识别出来的
 *   - 零额外调用：只用标题，不调平台接口
 *   - 幂等：同一件商品跑多次不会重复打标
 *   - 多标签：一件商品可以命中多个品类标签 + 多个品牌标签
 */
@Injectable()
export class AutoTagService implements OnModuleInit {
  private readonly logger = new Logger(AutoTagService.name);

  constructor(
    @InjectRepository(Topic) private readonly topicRepo: Repository<Topic>,
    @InjectRepository(GoodsTopic) private readonly relRepo: Repository<GoodsTopic>,
    @InjectRepository(CuratedGoods) private readonly goodsRepo: Repository<CuratedGoods>,
  ) {}

  /**
   * 启动时检查：如果一张标签都没有，初始化一批预置的品类标签。
   * 老系统已经有 topic 的话跳过，只在新部署时生效一次。
   */
  async onModuleInit() {
    try {
      const count = await this.topicRepo.count();
      if (count === 0) {
        this.logger.log('标签库为空，初始化预置品类标签...');
        await this.seedDefaultTopics();
      } else {
        // 老数据迁移：之前 autoBrand 的标签 type 是 category，统一迁到 brand
        await this.migrateBrandType();
      }
    } catch (e: any) {
      this.logger.warn(`初始化预置标签失败（可能表还不存在）: ${e.message}`);
    }
  }

  /** 把 autoBrand=true 但 type 不对的标签统一迁成 type=brand，幂等可重复跑 */
  private async migrateBrandType() {
    const r = await this.topicRepo
      .createQueryBuilder()
      .update()
      .set({ type: 'brand' })
      .where('autoBrand = 1 AND type <> :t', { t: 'brand' })
      .execute();
    if (r.affected) {
      this.logger.log(`品牌标签类型迁移完成: ${r.affected} 条 category → brand`);
    }
  }

  // ──────────────────────── 预置标签 ────────────────────────

  private readonly DEFAULT_TOPICS: Array<{ name: string; icon: string; bg: string; keywords: string[] }> = [
    {
      name: '母婴奶粉', icon: '🍼', bg: 'linear-gradient(135deg,#ffecd2,#fcb69f)',
      keywords: ['奶粉', '婴幼儿奶粉', '配方奶粉', '婴儿奶粉'],
    },
    {
      name: '母婴用品', icon: '👶', bg: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
      keywords: ['纸尿裤', '尿不湿', '奶瓶', '奶嘴', '湿巾', '婴儿湿巾', '拉拉裤', '学步鞋'],
    },
    {
      name: '美妆护肤', icon: '🧴', bg: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)',
      keywords: ['面膜', '精华', '面霜', '爽肤水', '乳液', '洗面奶', '洁面', '防晒霜', '护肤套装'],
    },
    {
      name: '美妆彩妆', icon: '💄', bg: 'linear-gradient(135deg,#ff9a9e,#fecfef)',
      keywords: ['口红', '粉底液', '眼影', '睫毛膏', '眉笔', '腮红', '唇釉', '遮瑕', '气垫'],
    },
    {
      name: '个护清洁', icon: '🧴', bg: 'linear-gradient(135deg,#84fab0,#8fd3f4)',
      keywords: ['洗发水', '沐浴露', '牙膏', '牙刷', '香皂', '洗衣液', '护发素', '沐浴乳'],
    },
    {
      name: '食品零食', icon: '🍪', bg: 'linear-gradient(135deg,#f6d365,#fda085)',
      keywords: ['零食', '饼干', '巧克力', '坚果', '牛肉干', '方便面', '螺蛳粉', '薯片', '辣条', '蛋黄酥'],
    },
    {
      name: '饮料冲调', icon: '☕', bg: 'linear-gradient(135deg,#d299c2,#fef9d7)',
      keywords: ['牛奶', '酸奶', '咖啡', '茶叶', '奶茶', '果汁', '矿泉水', '豆浆粉', '燕麦片'],
    },
    {
      name: '数码手机', icon: '📱', bg: 'linear-gradient(135deg,#667eea,#764ba2)',
      keywords: ['手机', '耳机', '平板', '笔记本', '电脑', '充电器', '数据线', '充电宝', '智能手表', '蓝牙耳机'],
    },
    {
      name: '家用电器', icon: '🏠', bg: 'linear-gradient(135deg,#f093fb,#f5576c)',
      keywords: ['电饭煲', '空气炸锅', '微波炉', '冰箱', '洗衣机', '吸尘器', '电烤箱', '豆浆机', '破壁机', '电磁炉'],
    },
    {
      name: '家居日用', icon: '🏡', bg: 'linear-gradient(135deg,#a8edea,#fed6e3)',
      keywords: ['纸巾', '抽纸', '卷纸', '垃圾袋', '收纳', '枕头', '被子', '四件套', '毛巾', '拖鞋'],
    },
    {
      name: '服饰鞋包', icon: '👗', bg: 'linear-gradient(135deg,#fddb92,#d1fdff)',
      keywords: ['连衣裙', 't恤', '运动鞋', '包包', '牛仔裤', '外套', '卫衣', '毛衣', '风衣', '羽绒服'],
    },
  ];

  private async seedDefaultTopics() {
    let created = 0;
    for (const t of this.DEFAULT_TOPICS) {
      const slug = `cat-${t.name}`;
      const exist = await this.topicRepo.findOneBy({ slug });
      if (exist) continue;
      await this.topicRepo.save(this.topicRepo.create({
        slug,
        name: t.name,
        icon: t.icon,
        bg: t.bg,
        intro: `精选${t.name}好物`,
        type: 'category',
        slot: 'hidden',
        status: 1,
        sortWeight: 100,
        keywordRules: JSON.stringify(t.keywords),
        autoBrand: false,
      }));
      created++;
    }
    this.logger.log(`初始化预置标签完成，新增 ${created} 个品类标签`);
  }

  // ──────────────────────── 公共方法 ────────────────────────

  /**
   * 给一件商品自动打标。
   * 返回实际新增的标签关联数。
   */
  /**
   * 打上「转链」运营标签：转链抓来的商品统一挂这个标签，便于筛选/推荐位识别。
   * 标签固定 slug=convert、slot=hidden（只做标签，不占首页宫格），幂等。
   * 返回是否新增关联。
   */
  async tagAsConvert(curatedId: number): Promise<number> {
    let topic = await this.topicRepo.findOneBy({ slug: 'convert' });
    if (!topic) {
      topic = await this.topicRepo.save(this.topicRepo.create({
        slug: 'convert',
        name: '转链',
        icon: '🔗',
        slot: 'hidden',
        type: 'operate',
        sortWeight: 0,
      }));
      this.logger.log('已创建「转链」运营标签');
    }
    const exist = await this.relRepo.findOneBy({ curatedId, topicId: topic.id });
    if (exist) return 0;
    await this.relRepo.save(this.relRepo.create({ curatedId, topicId: topic.id }));
    return 1;
  }

  async tagOne(curatedId: number, title: string): Promise<number> {
    if (!curatedId || !title) return 0;
    const { categoryIds, matchedBrands } = await this.matchFromTitle(title);
    const topicIds = await this.resolveBrandTopics(matchedBrands, categoryIds);
    return this.addTags(curatedId, topicIds);
  }

  /**
   * 给一批商品自动打标（批量）。
   * 返回 { tagged: 被打了标的商品数, newBrandTopics: 新建的品牌标签数 }。
   */
  async tagGoods(goods: Array<{ id: number; title: string }>): Promise<{ tagged: number; newBrandTopics: number }> {
    if (!goods.length) return { tagged: 0, newBrandTopics: 0 };

    // 先加载一次全量索引
    const index = await this.loadIndex();
    let tagged = 0;
    const brandTopicCache = new Map<string, number>(); // brandName → topicId

    for (const g of goods) {
      if (!g.id || !g.title) continue;
      const { categoryIds, matchedBrands } = this.matchFromIndex(g.title, index);
      const topicIds = await this.resolveBrandTopicsWithCache(matchedBrands, categoryIds, brandTopicCache);
      const added = await this.addTags(g.id, topicIds);
      if (added > 0) tagged++;
    }

    const newBrandTopics = brandTopicCache.size - index.brandTopics.size;
    return { tagged, newBrandTopics };
  }

  /**
   * 全量重跑：给所有上架商品自动打标。
   */
  async retagAll(): Promise<{ total: number; tagged: number; newBrandTopics: number }> {
    const BATCH = 500;
    let total = 0;
    let tagged = 0;
    let newBrandTopics = 0;
    let page = 1;

    while (true) {
      const rows = await this.goodsRepo.find({
        where: { status: CuratedStatus.ON },
        select: ['id', 'title'],
        skip: (page - 1) * BATCH,
        take: BATCH,
        order: { id: 'ASC' },
      });
      if (!rows.length) break;
      total += rows.length;

      const result = await this.tagGoods(rows);
      tagged += result.tagged;
      newBrandTopics += result.newBrandTopics;

      page++;
      if (rows.length < BATCH) break;
    }

    return { total, tagged, newBrandTopics };
  }

  // ──────────────────────── 匹配引擎 ────────────────────────

  /** 内存索引：品类标签 + 品牌标签映射 */
  private async loadIndex(): Promise<{
    categories: Array<{ id: number; keywords: string[] }>;
    brandTopics: Map<string, number>; // brandName(lowercase) → topicId
  }> {
    const all = await this.topicRepo.find({
      where: { status: 1 },
      select: ['id', 'name', 'keywordRules', 'autoBrand'],
    });

    const categories: Array<{ id: number; keywords: string[] }> = [];
    const brandTopics = new Map<string, number>();

    for (const t of all) {
      if (t.autoBrand) {
        const brandName = t.name.replace(/^品牌[·・]/, '').toLowerCase();
        brandTopics.set(brandName, t.id);
      } else if (t.keywordRules) {
        try {
          const keywords = JSON.parse(t.keywordRules);
          if (Array.isArray(keywords) && keywords.length) {
            categories.push({ id: t.id, keywords });
          }
        } catch { /* 解析失败跳过 */ }
      }
    }

    return { categories, brandTopics };
  }

  /**
   * 用已加载的索引从标题中匹配标签。
   * 返回 { categoryIds: 已命中的品类标签ID, matchedBrands: 命中的品牌名 }
   */
  private matchFromIndex(
    title: string,
    index: { categories: Array<{ id: number; keywords: string[] }>; brandTopics: Map<string, number> },
  ): { categoryIds: number[]; matchedBrands: string[] } {
    const t = title.toLowerCase();
    const categoryIds: number[] = [];
    const matchedBrands: string[] = [];

    // 品类标签匹配
    for (const topic of index.categories) {
      for (const kw of topic.keywords) {
        if (!kw) continue;
        if (t.includes(kw.toLowerCase())) {
          categoryIds.push(topic.id);
          break;
        }
      }
    }

    // 品牌词匹配（最多 3 个，避免一件商品打一堆品牌标签）
    for (const brand of BRAND_WORDS) {
      if (t.includes(brand.toLowerCase())) {
        matchedBrands.push(brand);
        if (matchedBrands.length >= 3) break;
      }
    }

    return { categoryIds, matchedBrands };
  }

  /** 简单版：从标题直接匹配（不预加载索引，单件用） */
  private async matchFromTitle(title: string): Promise<{ categoryIds: number[]; matchedBrands: string[] }> {
    const index = await this.loadIndex();
    return this.matchFromIndex(title, index);
  }

  // ──────────────────────── 品牌标签管理 ────────────────────────

  /**
   * 把品牌名解析成 topicId。
   * 已有的直接取 ID，没有的自动创建。
   */
  private async resolveBrandTopicsWithCache(
    brands: string[],
    baseIds: number[],
    cache: Map<string, number>,
  ): Promise<number[]> {
    const ids = [...baseIds];
    for (const brand of brands) {
      const key = brand.toLowerCase();
      let topicId = cache.get(key);
      if (!topicId) {
        topicId = await this.ensureBrandTag(brand);
        if (topicId) cache.set(key, topicId);
      }
      if (topicId) ids.push(topicId);
    }
    return ids;
  }

  private async resolveBrandTopics(brands: string[], baseIds: number[]): Promise<number[]> {
    const cache = new Map<string, number>();
    return this.resolveBrandTopicsWithCache(brands, baseIds, cache);
  }

  /**
   * 确保"品牌·XXX"标签存在，不存在就创建。
   * 返回 topicId。
   */
  private async ensureBrandTag(brand: string): Promise<number | null> {
    const name = `品牌·${brand}`;
    const exist = await this.topicRepo.findOneBy({ name });
    if (exist) return exist.id;

    try {
      const slug = `brand-${brand.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-')}`;
      const saved = await this.topicRepo.save(this.topicRepo.create({
        slug,
        name,
        icon: '🏷️',
        bg: 'linear-gradient(135deg,#e0eafc,#cfdef3)',
        intro: `${brand}品牌好物`,
        type: 'brand',
        slot: 'hidden',
        status: 1,
        sortWeight: 50,
        autoBrand: true,
      }));
      this.logger.log(`自动创建品牌标签: ${name}`);
      return saved.id;
    } catch {
      // 并发创建可能重复，查一下兜底
      const again = await this.topicRepo.findOneBy({ name });
      return again?.id ?? null;
    }
  }

  // ──────────────────────── 写入关联 ────────────────────────

  /**
   * 给商品加标签（只加新增的，已有的不动）。
   * 返回实际新增的数量。
   */
  private async addTags(curatedId: number, topicIds: number[]): Promise<number> {
    if (!topicIds.length) return 0;

    // 去重
    const uniqueIds = [...new Set(topicIds)];
    if (!uniqueIds.length) return 0;

    // 查已有标签
    const existRels = await this.relRepo.find({
      where: uniqueIds.map((tid) => ({ curatedId, topicId: tid })),
      select: ['topicId'],
    });
    const existSet = new Set(existRels.map((r) => r.topicId));

    // 只插新增的
    const toAdd = uniqueIds.filter((id) => !existSet.has(id));
    if (!toAdd.length) return 0;

    await this.relRepo.save(
      toAdd.map((tid) => this.relRepo.create({ curatedId, topicId: tid, sortWeight: 0 })),
    );

    this.logger.debug(`商品 ${curatedId} 自动打标 +${toAdd.length}`);
    return toAdd.length;
  }
}
