import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/entities';
import { CurrentUser } from '@/common/decorators';
import { Public } from '@/common/jwt.guard';
import { TopicService } from './topic.service';
import { RecommendService } from './recommend.service';
import { CommissionService } from '../commission/commission.service';

/** H5 侧：专题列表和专题页内容，都不需要登录 */
@ApiTags('专题')
@Controller('api/topics')
export class TopicController {
  constructor(
    private readonly svc: TopicService,
    private readonly commission: CommissionService,
    private readonly recommend: RecommendService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Public() @Get()
  @ApiOperation({ summary: '专题列表（首页宫格和活动位按 slot 自己筛）' })
  list() {
    return this.svc.listPublic().then((list) => ({ list }));
  }

  @Public() @Get(':slug')
  @ApiOperation({ summary: '专题详情' })
  one(@Param('slug') slug: string) {
    return this.svc.bySlug(slug);
  }

  /**
   * 专题下的商品。
   *
   * rebate（返利金额）必须在这一层附加：它 = 预估佣金 × 用户分成比例，
   * 而比例取决于「谁在看」（代理等级不同）。口径跟 /api/home/ranking 完全一致，
   * 两个入口显示的返利数字必须一模一样——同一件商品在首页和专题页返利不同，
   * 用户立刻就不信了。
   */
  @Public() @Get(':slug/goods')
  @ApiOperation({ summary: '专题下的商品；sort=rebate|price' })
  async goods(
    @Param('slug') slug: string,
    @Query('sort') sort = 'rebate',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @CurrentUser('sub') userId?: number,
  ) {
    const r = await this.svc.goods(slug, sort, +page, Math.min(+pageSize || 20, 100));

    const agentId = userId
      ? (await this.userRepo.findOneBy({ id: userId }))?.agentId ?? null
      : null;

    const withRebate = await Promise.all(r.list.map(async (g: any) => ({
      ...g,
      rebate: (await this.commission.preview(g.commission, agentId)).userRebate,
    })));

    // 顺手带上「我推过几次」，前端才画得出已推状态，省一次请求
    const mine = userId
      ? await this.recommend.mine(userId, withRebate.map((g: any) => ({
          platform: g.platform, goodsId: g.goodsId,
        })))
      : {};

    return {
      ...r,
      list: withRebate.map((g: any) => ({
        ...g,
        myRecommend: mine[`${g.platform}:${g.goodsId}`] ?? 0,
      })),
    };
  }
}

/**
 * 后台侧：走全局 JwtGuard。
 *
 * 建专题的返回里带 pageUrl，后台直接显示出来，运营不用猜 URL 填什么——
 * 这就是「自动生成页面」这件事的落点：页面是现成的通用页，
 * 建记录的同时地址就定了，不用改代码也不用发版。
 */
@ApiTags('后台·专题')
@Controller('api/admin/topics')
export class TopicAdminController {
  constructor(private readonly svc: TopicService) {}

  @Get()
  @ApiOperation({ summary: '专题列表，含下架的，带挂了多少件商品' })
  list() {
    return this.svc.listAdmin().then((list) => ({ list }));
  }

  @Post()
  @ApiOperation({ summary: '新建专题；slug 留空则按名字自动生成' })
  create(@Body() b: any) {
    return this.svc.create(b);
  }

  @Put(':id')
  @ApiOperation({ summary: '改专题（slug 不可改，改了等于换页面地址）' })
  update(@Param('id') id: string, @Body() b: any) {
    return this.svc.update(+id, b);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删专题，只解绑不删商品' })
  remove(@Param('id') id: string) {
    return this.svc.remove(+id);
  }

  @Get('of-goods/:curatedId')
  @ApiOperation({ summary: '某商品挂了哪些专题' })
  ofGoods(@Param('curatedId') id: string) {
    return this.svc.ofGoods(+id).then((topicIds) => ({ topicIds }));
  }

  @Post('of-goods/:curatedId')
  @ApiOperation({ summary: '设置某商品的专题（整套替换）' })
  setOfGoods(@Param('curatedId') id: string, @Body() b: { topicIds: number[] }) {
    return this.svc.setGoodsTopics(+id, b?.topicIds ?? []);
  }

  @Post(':id/tag-many')
  @ApiOperation({ summary: '批量把一批商品归到这个专题下' })
  tagMany(@Param('id') id: string, @Body() b: { curatedIds: number[] }) {
    return this.svc.tagMany(+id, b?.curatedIds ?? []);
  }

  @Post(':id/untag-many')
  @ApiOperation({ summary: '批量从这个专题里移出（只解绑，商品仍在池子里）' })
  untagMany(@Param('id') id: string, @Body() b: { curatedIds: number[] }) {
    return this.svc.untagMany(+id, b?.curatedIds ?? []);
  }
}
