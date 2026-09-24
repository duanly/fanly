import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsString, Min } from 'class-validator';
import { FundService } from './fund.service';
import { CurrentUser } from '@/common/decorators';

class WithdrawDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsIn(['WECHAT', 'ALIPAY']) channel: string;
  @IsString() accountInfo: string;
}

@ApiTags('资金')
@Controller('api/fund')
export class FundController {
  constructor(private readonly fund: FundService) {}

  @Get('balance')
  @ApiOperation({ summary: '余额：可提现 / 冻结 / 预估返利' })
  balance(@CurrentUser('sub') userId: number) { return this.fund.balance(userId); }

  @Get('ledger')
  @ApiOperation({ summary: '资金流水' })
  ledger(
    @CurrentUser('sub') userId: number,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('bizType') bizType?: string,
  ) { return this.fund.ledger(userId, +page, +pageSize, bizType); }

  @Get('withdraws')
  @ApiOperation({ summary: '我的提现记录，带审核/打款状态' })
  withdraws(
    @CurrentUser('sub') userId: number,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) { return this.fund.myWithdraws(userId, +page, +pageSize); }

  @Get('summary')
  @ApiOperation({ summary: '收益概览：余额、本月已到账、本月提现、累计' })
  summary(@CurrentUser('sub') userId: number) { return this.fund.summary(userId); }

  @Post('withdraw')
  @ApiOperation({ summary: '申请提现' })
  withdraw(@CurrentUser('sub') userId: number, @Body() dto: WithdrawDto) {
    return this.fund.applyWithdraw(userId, dto.amount, dto.channel, dto.accountInfo);
  }
}
