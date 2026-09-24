import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomeLinkService } from './home.service';
import { RankingService } from './ranking.service';
import { RecommendService } from './recommend.service';
import { CommissionService } from '../commission/commission.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/entities';
import { CurrentUser } from '@/common/decorators';
import { Public } from '@/common/jwt.guard';

@ApiTags('首页')
@Controller('api/home')
export class HomeController {
  constructor(
    private readonly links: HomeLinkService,
    private readonly ranking: RankingService,
    private readonly recommend: RecommendService,
    private readonly commission: CommissionService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Public() @Get('links')
  @ApiOperation({ summary: '首页配置项：slot=banner 跑马灯 / category 分区 / entry 活动位；不传给全部' })
  linkList(@Query('slot') slot?: string) { return this.links.publicList(slot || undefined); }

  @Public() @Get('ranking')
  @ApiOperation({ summary: '榜单：hot 热销 / rebate 返利 / pick 主编推荐' })
  async rank(
    @Query('type') type = 'hot',
    @Query('limit') limit = '10',
    @CurrentUser('sub') userId?: number,
  ) {
    const n = Math.min(+limit || 10, 50);
    const list = type === 'rebate' ? await this.ranking.rebate(n)
      : type === 'pick' ? await this.ranking.pick(n)
      : await this.ranking.hot(7, n);

    const agentId = userId
      ? (await this.userRepo.findOneBy({ id: userId }))?.agentId ?? null
      : null;
    const withRebate = await Promise.all(list.map(async (g: any) => ({
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
      type,
      list: withRebate.map((g: any) => ({
        ...g,
        myRecommend: mine[`${g.platform}:${g.goodsId}`] ?? 0,
      })),
    };
  }
}

@ApiTags('商品推荐')
@Controller('api/goods')
export class RecommendController {
  constructor(private readonly recommend: RecommendService) {}

  @Post('recommend')
  @ApiOperation({ summary: '推荐一次，有次数上限' })
  add(
    @CurrentUser('sub') userId: number,
    @Body() body: { platform: string; goodsId: string },
  ) {
    return this.recommend.recommend(userId, body?.platform, body?.goodsId);
  }

  @Post('recommend/mine')
  @ApiOperation({ summary: '批量查我对这些商品推了几次' })
  mine(
    @CurrentUser('sub') userId: number,
    @Body() body: { items: { platform: string; goodsId: string }[] },
  ) {
    return this.recommend.mine(userId, body?.items ?? []);
  }
}

@ApiTags('后台·首页运营')
@Controller('api/admin/home')
export class HomeAdminController {
  constructor(private readonly links: HomeLinkService) {}

  @Get('links')
  @ApiOperation({ summary: '首页配置列表，含下架的；可按 slot 过滤' })
  list(@Query('slot') slot?: string) { return this.links.adminList(slot || undefined); }

  @Post('links')
  @ApiOperation({ summary: '新增或修改活动位' })
  save(@Body() body: any) { return this.links.save(body); }

  @Delete('links/:id')
  @ApiOperation({ summary: '删除活动位' })
  remove(@Param('id') id: string) { return this.links.remove(+id); }
}
