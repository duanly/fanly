import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { AuthzService } from './authz.service';

@ApiTags('选品与转链')
@Controller('api')
export class GoodsController {
  constructor(
    private readonly cps: CpsService,
    private readonly commission: CommissionService,
    @InjectRepository(PromotionPosition) private readonly posRepo: Repository<PromotionPosition>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CuratedGoods) private readonly curatedRepo: Repository<CuratedGoods>,
    private readonly curation: CurationService,
    private readonly authz: AuthzService,
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
  @ApiOperation({ summary: '搜索商品' })
  async search(
    @Query('platform') platform = 'PDD',
    @Query('keyword') keyword?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('sort') sort?: string,
    @CurrentUser('sub') userId?: number,
  ) {
    // platform=ALL：四家并发查了合并，这是「统一货架」的搜索形态
    // sort=rebate：多拉几页按佣金金额降序，等价于按到手返利降序，
    //              比平台自带的「佣金比例」排序靠谱
    const all = (platform || '').toUpperCase() === 'ALL';
    const list = all
      ? await this.cps.searchAll({ keyword, pageSize: +pageSize, sort })
      : sort === 'rebate'
        ? await this.cps.searchByRebate(platform, { keyword, pageSize: +pageSize })
        : await this.cps.searchGoods(platform, {
            keyword, page: +page, pageSize: +pageSize, sort,
          });
    return {
      list: await this.withCompare(await this.withRebate(list, userId)),
      page: +page,
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
  @ApiOperation({ summary: '首页 feed：优先选品池，池空时回落平台榜单；不传 platform 则跨平台混排' })
  async feed(
    @Query('group') group = 'default',
    @Query('platform') platform?: string,
    @Query('limit') limit = '20',
    @CurrentUser('sub') userId?: number,
  ) {
    // platform 不传就是「统一货架」模式：选品池里所有平台的商品混在一起，
    // 用户只看商品，不关心它来自哪家。传了才按平台过滤。
    const pool = await this.curation.feed(group, +limit, platform);
    if (pool.length) {
      return { source: 'curated', list: await this.withRebate(pool, userId) };
    }
    // 池子空的时候只能回落到某一家的榜单，没有跨平台可言，默认拼多多
    const list = await this.cps.recommendGoods(platform || 'PDD', {
      channel: 'earn', pageSize: +limit,
    });
    return { source: 'recommend', list: await this.withRebate(list, userId) };
  }

  @Public() @Get('goods/groups')
  @ApiOperation({ summary: '有哪些专题（只给在架的）' })
  async publicGroups() {
    const all = await this.curation.groups();
    return all.filter((g) => g.onShelf > 0);
  }

  @Public() @Get('goods/:platform/:goodsId')
  @ApiOperation({ summary: '商品详情' })
  async detail(
    @Param('platform') platform: string,
    @Param('goodsId') goodsId: string,
    @CurrentUser('sub') userId?: number,
  ) {
    const g = await this.cps.getGoodsDetail(platform, goodsId);
    if (!g) return null;
    return (await this.withRebate([g], userId))[0];
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
    return this.cps.convertLink(body.platform, body.goodsId, pos.positionId);
  }

  @Post('link/parse')
  @ApiOperation({ summary: '口令/链接解析，认出商品并直接转好链' })
  async parse(@Body() body: { content: string }, @CurrentUser('sub') userId: number) {
    const { goods, platform, reason } = await this.cps.parseAny(body?.content || '');
    if (!goods) {
      // 认不出来也算正常结果，带上原因让前端直接展示，不要抛 500
      return { ok: false, platform, reason: reason || '没认出这个商品' };
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

    return {
      ok: true,
      platform: goods.platform,
      platformName: platformName(goods.platform),
      goods: withRebate,
      link,
    };
  }
}
