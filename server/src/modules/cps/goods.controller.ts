import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CpsService } from './cps.service';
import { CuratedGoods, PromotionPosition, User } from '@/entities';
import { CurrentUser } from '@/common/decorators';
import { Public } from '@/common/jwt.guard';
import { CommissionService } from '../commission/commission.service';
import { platformName } from '@/common/share-content';
import { CurationService } from '../curation/curation.service';
import { AutoTagService } from '../curation/auto-tag.service';
import { SysConfigService } from '../admin/sys-config.service';
import { AuthzService } from './authz.service';
import { ConvertLogService } from '../order/convert-log.service';

@ApiTags('选品与转链')
@Controller('api')
export class GoodsController {
  private readonly logger = new Logger(GoodsController.name);

  constructor(
    private readonly cps: CpsService,
    private readonly commission: CommissionService,
    @InjectRepository(PromotionPosition) private readonly posRepo: Repository<PromotionPosition>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CuratedGoods) private readonly curatedRepo: Repository<CuratedGoods>,
    private readonly curation: CurationService,
    private readonly autoTag: AutoTagService,
    private readonly cfg: SysConfigService,
    private readonly authz: AuthzService,
    private readonly convertLog: ConvertLogService,
  ) {}

  /**
   * 标出哪些商品进了比价组。
   * 用户搜到一件东西，我们知道它在别家也有，这个信息不给出来就浪费了——
   * 「还有 3 个平台可比」是让人点进去的理由。
   */
  private async withCompare(list: any[]) {
    if (!list.length) return list;
    const rows = await this.curatedRepo.find({
      where: list.map((g) => ({ platform: g.platform, goodsId: g.goodsId })),
    });
    const map = new Map(
      rows.filter((r) => r.compareGroupId).map((r) => [`${r.platform}:${r.goodsId}`, r.compareGroupId]),
    );
    return list.map((g) => ({
      ...g,
      compareGroupId: map.get(`${g.platform}:${g.goodsId}`) ?? null,
    }));
  }

  /** 给商品挂上"预计返 ¥X" */
  private async withRebate(list: any[], userId?: number) {
    const agentId = userId
      ? (await this.userRepo.findOneBy({ id: userId }))?.agentId ?? null
      : null;
    return Promise.all(list.map(async (g) => ({
      ...g,
      rebate: (await this.commission.preview(g.commission, agentId)).userRebate,
    })));
  }

  @Public() @Get('goods/search')
  @ApiOperation({ summary: '搜索商品（从选品池搜，不实时调平台 API）' })
  async search(
    @Query('platform') platform = 'ALL',
    @Query('keyword') keyword?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('sort') sort?: string,
    @CurrentUser('sub') userId?: number,
  ) {
    // H5 搜索走选品池，不再实时调第三方平台 API。
    // 好处：响应快、不触发限流、价格跟列表页一致。
    // 搜不到是正常的——我们是精选模式，不是全量平台搜索。
    const result = await this.curation.searchPage({
      keyword,
      platform,
      page: +page,
      pageSize: +pageSize,
      sort,
    });
    return {
      list: await this.withCompare(await this.withRebate(result.list, userId)),
      page: result.page,
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  @Public() @Get('goods/recommend')
  @ApiOperation({ summary: '平台榜单（实时收益榜）' })
  async recommend(
    @Query('platform') platform = 'PDD',
    @Query('channel') channel = 'earn',
    @Query('pageSize') pageSize = '12',
    @CurrentUser('sub') userId?: number,
  ) {
    const list = await this.cps.recommendGoods(platform, { channel, pageSize: +pageSize });
    return { list: await this.withRebate(list, userId) };
  }

  @Public() @Get('goods/feed')
  @ApiOperation({ summary: '首页 feed：从选品池读，不传 platform 则跨平台混排' })
  async feed(
    @Query('group') group = 'default',
    @Query('platform') platform?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @CurrentUser('sub') userId?: number,
  ) {
    // 兼容老参数 limit
    const size = Math.min(Math.max(+pageSize || +limit || 20, 5), 100);
    const p = Math.max(+page || 1, 1);

    // platform 不传就是「统一货架」模式：选品池里所有平台的商品混在一起，
    // 用户只看商品，不关心它来自哪家。传了才按平台过滤。
    const pageData = await this.curation.feedPage({
      groupKey: group,
      platform,
      page: p,
      pageSize: size,
      sort,
    });
    return {
      source: 'curated',
      total: pageData.total,
      page: pageData.page,
      pageSize: pageData.pageSize,
      hasMore: pageData.hasMore,
      list: await this.withRebate(pageData.list, userId),
    };
  }

  @Public() @Get('goods/groups')
  @ApiOperation({ summary: '有哪些专题（只给在架的）' })
  async publicGroups() {
    const all = await this.curation.groups();
    return all.filter((g) => g.onShelf > 0);
  }

  @Public() @Get('goods/:platform/:goodsId')
  @ApiOperation({ summary: '商品详情（从选品池读，不实时调平台 API）' })
  async detail(
    @Param('platform') platform: string,
    @Param('goodsId') goodsId: string,
    @CurrentUser('sub') userId?: number,
  ) {
    const p = platform.toUpperCase();
    // 从选品池读，保证跟列表页价格一致，也更快
    const cached = await this.curatedRepo.findOneBy({ platform: p, goodsId });
    if (!cached || cached.status === 0) {
      // 选品池里没有或已下架，直接返回 null——不再偷偷去调平台 API
      return null;
    }
    let images: string[] = [];
    try { images = JSON.parse(cached.images || '[]'); } catch { /* ignore */ }
    const g = {
      platform: cached.platform,
      goodsId: cached.goodsId,
      title: cached.title,
      image: cached.image,
      images,
      shopName: cached.shopName,
      price: Number(cached.price),
      couponPrice: Number(cached.couponPrice),
      couponAmount: Number(cached.couponAmount),
      commissionRate: Number(cached.commissionRate),
      commission: Number(cached.commission),
      salesVolume: cached.salesVolume,
    };
    const result = (await this.withRebate([g], userId))[0];
    // 后台异步刷新一下，下次进来就是最新价了。
    // 超过 30 分钟没刷的才刷，避免每个请求都打平台接口
    const stale = !cached.lastSyncAt
      || Date.now() - new Date(cached.lastSyncAt).getTime() > 30 * 60 * 1000;
    if (stale) {
      this.curation.refreshById(cached.id).catch(() => { /* 失败不影响当前请求 */ });
    }
    return result;
  }

  @Post('link/convert')
  @ApiOperation({ summary: '转链，返回短链/口令/deeplink' })
  async convert(
    @Body() body: { platform: string; goodsId: string },
    @CurrentUser('sub') userId: number,
  ) {
    // 没授权就先别转链——转了也认不到订单，白白浪费一次跳转
    const gate = await this.authz.gate(userId, body.platform);
    if (gate) return gate;

    const pos = await this.posRepo.findOneBy({ userId, platform: body.platform });
    if (!pos) throw new Error('推广位缺失，请重新登录');
    const result = await this.cps.convertLink(body.platform, body.goodsId, pos.positionId);
    // 记录转链，作为订单标识丢失时的兜底依据
    await this.convertLog.record({
      userId,
      platform: body.platform,
      goodsId: body.goodsId,
      positionId: pos.positionId,
      source: 'convert',
    });
    return result;
  }

  @Post('link/parse')
  @ApiOperation({ summary: '口令/链接解析，认出商品并直接转好链' })
  async parse(@Body() body: { content: string }, @CurrentUser('sub') userId: number) {
    const { goods, platform, reason } = await this.cps.parseAny(body?.content || '');
    if (!goods) {
      // 认不出来也算正常结果，带上原因让前端直接展示，不要抛 500
      return { ok: false, platform, reason: reason || '没认出这个商品' };
    }

    // 抓到的商品直接放到平台：佣金>0 即 ON 上架 + 高推荐权重 + 「转链」标签；
    // 已在池里的不降级。失败只记日志，不挡住本次转链结果展示
    try {
      const sortWeight = this.cfg.num('goods.convert_sort_weight', 900);
      const row = await this.curation.addFromConvert(goods, sortWeight);
      await this.autoTag.tagAsConvert(row.curatedId);
    } catch (e: any) {
      this.logger.warn(`转链商品入库失败: ${e.message}`);
    }

    const [withRebate] = await this.withRebate([goods], userId);

    // 先把商品和返利给用户看到，再谈授权——有了预期才愿意多点一步
    const gate = await this.authz.gate(userId, goods.platform);
    if (gate) {
      return {
        ok: true,
        platform: goods.platform,
        platformName: platformName(goods.platform),
        goods: withRebate,
        link: null,
        ...gate,
      };
    }

    const pos = await this.posRepo.findOneBy({ userId, platform: goods.platform });
    const link = pos
      ? await this.cps.convertLink(goods.platform, goods.goodsId, pos.positionId)
      : null;

    // 记录本次解析转链（标识丢失兜底）
    if (link) {
      await this.convertLog.record({
        userId,
        platform: goods.platform,
        goodsId: goods.goodsId,
        positionId: pos?.positionId,
        source: 'parse',
      });
    }

    return {
      ok: true,
      platform: goods.platform,
      platformName: platformName(goods.platform),
      goods: withRebate,
      link,
    };
  }
}
