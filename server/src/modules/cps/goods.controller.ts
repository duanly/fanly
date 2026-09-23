import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CpsService } from './cps.service';
import { PromotionPosition, User } from '@/entities';
import { CurrentUser } from '@/common/decorators';
import { Public } from '@/common/jwt.guard';
import { CommissionService } from '../commission/commission.service';

@ApiTags('选品与转链')
@Controller('api')
export class GoodsController {
  constructor(
    private readonly cps: CpsService,
    private readonly commission: CommissionService,
    @InjectRepository(PromotionPosition) private readonly posRepo: Repository<PromotionPosition>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

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
    const list = await this.cps.searchGoods(platform, {
      keyword, page: +page, pageSize: +pageSize, sort,
    });
    return { list: await this.withRebate(list, userId), page: +page };
  }

  @Public() @Get('goods/recommend')
  @ApiOperation({ summary: '首页榜单' })
  async recommend(@Query('platform') platform = 'PDD', @CurrentUser('sub') userId?: number) {
    const list = await this.cps.searchGoods(platform, { pageSize: 12, sort: 'sales' });
    return { list: await this.withRebate(list, userId) };
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
    const pos = await this.posRepo.findOneBy({ userId, platform: body.platform });
    if (!pos) throw new Error('推广位缺失，请重新登录');
    return this.cps.convertLink(body.platform, body.goodsId, pos.positionId);
  }

  @Post('link/parse')
  @ApiOperation({ summary: '口令/链接解析' })
  async parse(@Body() body: { content: string }, @CurrentUser('sub') userId: number) {
    const g = await this.cps.parseAny(body.content);
    if (!g) return null;
    const [withRebate] = await this.withRebate([g], userId);
    const pos = await this.posRepo.findOneBy({ userId, platform: g.platform });
    const link = pos ? await this.cps.convertLink(g.platform, g.goodsId, pos.positionId) : null;
    return { goods: withRebate, link };
  }
}
