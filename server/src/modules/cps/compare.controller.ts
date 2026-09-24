import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompareService } from './compare.service';
import { CommissionService } from '../commission/commission.service';
import { User } from '@/entities';
import { CurrentUser } from '@/common/decorators';
import { Public } from '@/common/jwt.guard';

/**
 * 把「到手价」算出来：到手价 = 券后价 − 返利。
 *
 * 这是我们跟普通比价工具的区别——别人比券后价，我们比返利之后真正付出的钱。
 * 各平台佣金率不同，经常出现券后价更低但到手价更高的情况，那才是用户要的答案。
 */
async function priceOf(
  commission: CommissionService,
  items: any[],
  agentId: number | null,
) {
  const rows = await Promise.all(items.map(async (g) => {
    const rebate = (await commission.preview(g.commission, agentId)).userRebate;
    return {
      ...g,
      rebate,
      finalPrice: Math.round((g.couponPrice - rebate) * 100) / 100,
    };
  }));
  // 到手价升序：第一条就是最划算的那家
  rows.sort((a, b) => a.finalPrice - b.finalPrice);
  return rows;
}

@ApiTags('比价')
@Controller('api/compare')
export class ComparePublicController {
  constructor(
    private readonly compare: CompareService,
    private readonly commission: CommissionService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private async agentOf(userId?: number) {
    if (!userId) return null;
    return (await this.userRepo.findOneBy({ id: userId }))?.agentId ?? null;
  }

  @Public() @Get('list')
  @ApiOperation({ summary: '比价专区列表，每组给最低到手价和最多能省多少' })
  async list(
    @Query('group') group?: string,
    @Query('limit') limit = '20',
    @CurrentUser('sub') userId?: number,
  ) {
    const agentId = await this.agentOf(userId);
    const groups = await this.compare.publicList(group, +limit);

    return Promise.all(groups.map(async (g) => {
      const items = await priceOf(this.commission, g.items, agentId);
      const best = items[0];
      const worst = items[items.length - 1];
      return {
        id: g.id,
        name: g.name,
        spec: g.spec,
        cover: g.cover || best?.image || '',
        platformCount: items.length,
        platforms: items.map((i) => i.platform),
        best: best
          ? { platform: best.platform, couponPrice: best.couponPrice, rebate: best.rebate, finalPrice: best.finalPrice }
          : null,
        // 最贵和最便宜的差价，就是「在我们这儿比价能省多少」
        maxSave: best && worst
          ? Math.round((worst.finalPrice - best.finalPrice) * 100) / 100
          : 0,
      };
    }));
  }

  @Public() @Get(':id')
  @ApiOperation({ summary: '比价详情：各平台到手价并排，按到手价升序' })
  async detail(@Param('id') id: string, @CurrentUser('sub') userId?: number) {
    const agentId = await this.agentOf(userId);
    const g = await this.compare.detail(+id);
    const items = await priceOf(this.commission, g.items, agentId);
    return {
      ...g,
      items,
      // 快照可能过期，前端必须把这个时间显示出来
      syncedAt: items.reduce(
        (acc: any, i: any) => (!acc || (i.lastSyncAt && i.lastSyncAt < acc) ? i.lastSyncAt : acc),
        null,
      ),
    };
  }
}

@ApiTags('后台·比价')
@Controller('api/admin/compare')
export class CompareAdminController {
  constructor(private readonly compare: CompareService) {}

  @Get('list')
  @ApiOperation({ summary: '比价组列表，带成员' })
  list(
    @Query('groupKey') groupKey?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.compare.adminList(groupKey || undefined, +page, +pageSize);
  }

  @Post('save')
  @ApiOperation({ summary: '新建或修改比价组' })
  save(@Body() body: any) { return this.compare.createOrUpdate(body); }

  @Post(':id/members')
  @ApiOperation({ summary: '把选品池里的商品加进这个组，一个平台只留一件' })
  addMembers(@Param('id') id: string, @Body() body: { curatedIds: number[] }) {
    return this.compare.addMembers(+id, body?.curatedIds ?? []);
  }

  @Delete(':id/members/:curatedId')
  @ApiOperation({ summary: '把某件商品移出组，商品本身仍留在选品池' })
  removeMember(@Param('id') id: string, @Param('curatedId') curatedId: string) {
    return this.compare.removeMember(+id, +curatedId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除比价组' })
  remove(@Param('id') id: string) { return this.compare.remove(+id); }
}
