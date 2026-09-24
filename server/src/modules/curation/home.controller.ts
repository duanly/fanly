import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomeLinkService } from './home.service';
import { RankingService } from './ranking.service';
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
    private readonly commission: CommissionService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Public() @Get('links')
  @ApiOperation({ summary: '首页活动位，后台配的' })
  linkList() { return this.links.publicList(); }

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
    return {
      type,
      list: await Promise.all(list.map(async (g: any) => ({
        ...g,
        rebate: (await this.commission.preview(g.commission, agentId)).userRebate,
      }))),
    };
  }
}

@ApiTags('后台·首页运营')
@Controller('api/admin/home')
export class HomeAdminController {
  constructor(private readonly links: HomeLinkService) {}

  @Get('links')
  @ApiOperation({ summary: '活动位列表，含下架的' })
  list() { return this.links.adminList(); }

  @Post('links')
  @ApiOperation({ summary: '新增或修改活动位' })
  save(@Body() body: any) { return this.links.save(body); }

  @Delete('links/:id')
  @ApiOperation({ summary: '删除活动位' })
  remove(@Param('id') id: string) { return this.links.remove(+id); }
}
