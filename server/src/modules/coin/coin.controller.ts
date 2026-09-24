import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoinService } from './coin.service';
import { CurrentUser } from '@/common/decorators';

@ApiTags('签到与金币')
@Controller('api/coin')
export class CoinController {
  constructor(private readonly coin: CoinService) {}

  @Get('status')
  @ApiOperation({ summary: '签到状态、连续天数、本月日历、金币余额' })
  status(@CurrentUser('sub') userId: number) { return this.coin.status(userId); }

  @Post('checkin')
  @ApiOperation({ summary: '签到，重复签到不报错' })
  checkin(@CurrentUser('sub') userId: number) { return this.coin.checkin(userId); }

  @Post('exchange')
  @ApiOperation({ summary: '金币兑换余额' })
  exchange(@CurrentUser('sub') userId: number, @Body() body: { coins: number }) {
    return this.coin.exchange(userId, Number(body?.coins) || 0);
  }

  @Get('ledger')
  @ApiOperation({ summary: '金币流水' })
  ledger(
    @CurrentUser('sub') userId: number,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) { return this.coin.ledger(userId, +page, +pageSize); }
}
