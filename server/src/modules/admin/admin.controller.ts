import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AdminUser, Withdraw, WithdrawStatus } from '@/entities';
import { Public } from '@/common/jwt.guard';
import { CurrentUser } from '@/common/decorators';
import { SysConfigService } from './sys-config.service';
import { AgentService } from '../agent/agent.service';
import { OrderService } from '../order/order.service';
import { FundService } from '../fund/fund.service';

@ApiTags('管理后台')
@Controller('api/admin')
export class AdminController {
  constructor(
    @InjectRepository(AdminUser) private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Withdraw) private readonly wdRepo: Repository<Withdraw>,
    private readonly jwt: JwtService,
    private readonly cfg: SysConfigService,
    private readonly agent: AgentService,
    private readonly order: OrderService,
    private readonly fund: FundService,
  ) {}

  @Public() @Post('login')
  @ApiOperation({ summary: '后台登录' })
  async login(@Body() body: { username: string; password: string }) {
    const admin = await this.adminRepo.findOneBy({ username: body.username });
    if (!admin || !bcrypt.compareSync(body.password, admin.password)) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const token = await this.jwt.signAsync({ sub: admin.id, admin: true, role: admin.role });
    return { token, role: admin.role, username: admin.username };
  }

  @Get('config')
  @ApiOperation({ summary: '系统参数列表（分佣比例等）' })
  config() { return this.cfg.list(); }

  @Post('config')
  @ApiOperation({ summary: '修改系统参数，立即生效' })
  async setConfig(@Body() body: { key: string; value: string }) {
    await this.cfg.set(body.key, body.value);
    return { key: body.key, value: body.value };
  }

  @Get('agents')
  @ApiOperation({ summary: '代理列表（带业绩）' })
  agents(@Query('status') status?: string, @Query('page') page = '1') {
    return this.agent.adminList(status !== undefined && status !== '' ? +status : undefined, +page);
  }

  @Post('agents/:id')
  @ApiOperation({ summary: '审核/调整代理：status 0待审 1正常 2冻结，level 1/2/3，agentRate 自定义比例' })
  updateAgent(@Param('id') id: string, @Body() body: any) {
    return this.agent.adminUpdate(+id, body);
  }

  @Get('orders')
  @ApiOperation({ summary: '全量订单' })
  orders(@Query() q: any) {
    return this.order.listAll({
      platform: q.platform, status: q.status ? +q.status : undefined,
      agentId: q.agentId ? +q.agentId : undefined,
      page: q.page ? +q.page : 1, size: q.pageSize ? +q.pageSize : 20,
    });
  }

  @Post('orders/sync')
  @ApiOperation({ summary: '手动触发拉单' })
  sync(@Body() body: { hours?: number }) { return this.order.syncAll(body?.hours ?? 24); }

  @Get('withdraws')
  @ApiOperation({ summary: '提现列表' })
  async withdraws(@Query('status') status?: string, @Query('page') page = '1') {
    const where: any = {};
    if (status) where.status = +status;
    const [list, total] = await this.wdRepo.findAndCount({
      where, order: { id: 'DESC' }, skip: (+page - 1) * 20, take: 20,
    });
    return { list, total };
  }

  @Post('withdraws/:id/audit')
  @ApiOperation({ summary: '提现审核' })
  audit(
    @Param('id') id: string,
    @Body() body: { pass: boolean; reason?: string },
    @CurrentUser('sub') adminId: number,
  ) { return this.fund.auditWithdraw(+id, body.pass, adminId, body.reason); }

  @Post('withdraws/:id/finish')
  @ApiOperation({ summary: '打款结果登记（真实通道接入前手工用）' })
  finish(@Param('id') id: string, @Body() body: { success: boolean; channelOrderNo?: string; failReason?: string }) {
    return this.fund.finishWithdraw(+id, body.success, body.channelOrderNo, body.failReason);
  }

  @Get('reconcile')
  @ApiOperation({ summary: '对账：用流水重放余额，返回不一致的账号' })
  reconcile() { return this.fund.reconcile(); }
}
