import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartService } from './cart.service';
import { CommissionService } from '../commission/commission.service';
import { User } from '@/entities';
import { CurrentUser } from '@/common/decorators';

@ApiTags('购物车')
@Controller('api/cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly commission: CommissionService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /** 给每件算上返利和到手价 —— 购物车的意义就是看合计能省多少 */
  private async withRebate(items: any[], userId: number) {
    const agentId = (await this.userRepo.findOneBy({ id: userId }))?.agentId ?? null;
    return Promise.all(items.map(async (i) => {
      const rebate = (await this.commission.preview(i.commission, agentId)).userRebate;
      return {
        ...i,
        rebate,
        finalPrice: Math.round((i.couponPrice - rebate) * 100) / 100,
      };
    }));
  }

  @Get()
  @ApiOperation({ summary: '购物车列表（快照价，秒出）' })
  async list(@CurrentUser('sub') userId: number) {
    return { list: await this.withRebate(await this.cart.list(userId), userId) };
  }

  @Get('count')
  @ApiOperation({ summary: '角标用的件数' })
  async count(@CurrentUser('sub') userId: number) {
    return { count: await this.cart.count(userId) };
  }

  @Post('refresh')
  @ApiOperation({ summary: '刷新价格，前端在拿到 list 之后后台调' })
  async refresh(@CurrentUser('sub') userId: number) {
    return { list: await this.withRebate(await this.cart.refresh(userId), userId) };
  }

  @Post('add')
  @ApiOperation({ summary: '加入购物车' })
  add(
    @CurrentUser('sub') userId: number,
    @Body() body: { platform: string; goodsId: string },
  ) {
    return this.cart.add(userId, body?.platform, body?.goodsId);
  }

  @Delete()
  @ApiOperation({ summary: '批量移除' })
  remove(@CurrentUser('sub') userId: number, @Body() body: { ids: number[] }) {
    return this.cart.remove(userId, body?.ids ?? []);
  }
}
