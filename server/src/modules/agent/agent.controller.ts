import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { CurrentUser } from '@/common/decorators';
import { Public } from '@/common/jwt.guard';

@ApiTags('代理')
@Controller('api/agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('apply')
  @ApiOperation({ summary: '申请成为代理（免费）' })
  apply(@CurrentUser('sub') userId: number, @Body() body: { realName?: string }) {
    return this.agent.apply(userId, body?.realName);
  }

  @Get('qrcode')
  @ApiOperation({ summary: '我的专属推广二维码' })
  qrcode(@CurrentUser('sub') userId: number) { return this.agent.qrcode(userId); }

  @Get('team')
  @ApiOperation({ summary: '我的团队' })
  team(
    @CurrentUser('sub') userId: number,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) { return this.agent.team(userId, +page, +pageSize); }

  @Get('stats')
  @ApiOperation({ summary: '我的业绩' })
  stats(
    @CurrentUser('sub') userId: number,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) { return this.agent.stats(userId, start, end); }

  @Public() @Get('info')
  @ApiOperation({ summary: '扫码落地页：根据推广码展示代理信息' })
  async info(@Query('code') code: string) {
    const a = await this.agent.findByCode(code?.toUpperCase());
    return a ? { agentCode: a.agentCode, realName: a.realName, valid: a.status === 1 } : null;
  }
}
