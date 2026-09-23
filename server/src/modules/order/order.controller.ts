import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CurrentUser } from '@/common/decorators';

@ApiTags('订单')
@Controller('api/orders')
export class OrderController {
  constructor(private readonly order: OrderService) {}

  @Get()
  @ApiOperation({ summary: '我的订单，status: 1待收货 2已收货 3已结算 4已失效 5已入账' })
  list(
    @CurrentUser('sub') userId: number,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.order.listByUser(userId, status ? +status : undefined, +page, +pageSize);
  }
}
