import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AdminUser, User, Withdraw, WithdrawStatus } from '@/entities';
import { Public } from '@/common/jwt.guard';
import { CurrentUser } from '@/common/decorators';
import { SysConfigService } from './sys-config.service';
import { AgentService } from '../agent/agent.service';
import { OrderService } from '../order/order.service';
import { FundService } from '../fund/fund.service';
import { JutuikeService } from '../jutuike/jutuike.service';

@ApiTags('管理后台')
@Controller('api/admin')
export class AdminController {
  constructor(
    @InjectRepository(AdminUser) private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Withdraw) private readonly wdRepo: Repository<Withdraw>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly cfg: SysConfigService,
    private readonly agent: AgentService,
    private readonly order: OrderService,
    private readonly fund: FundService,
    private readonly jtk: JutuikeService,
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
  agents(
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('minLevel') minLevel?: string,
    @Query('page') page = '1',
  ) {
    return this.agent.adminList({
      status: status !== undefined && status !== '' ? +status : undefined,
      keyword: keyword || undefined,
      minLevel: minLevel ? +minLevel : undefined,
      page: +page,
    });
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
      userId: q.userId ? +q.userId : undefined,
      keyword: q.keyword || undefined,
      agentKeyword: q.agentKeyword || undefined,
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

  @Post('orders/recalc-pending')
  @ApiOperation({ summary: '重算所有用户的预估返利（pending），修复历史数据不准的问题' })
  recalcPending() { return this.order.recalcPending(); }

  @Post('orders/rebuild-pending-details')
  @ApiOperation({ summary: '重建所有未结算订单的预估分佣明细（代理待结算收益）' })
  rebuildPendingDetails() { return this.order.rebuildPendingDetails(); }

  @Post('orders/:id/assign')
  @ApiOperation({ summary: '手动指派订单归属人（按用户ID）' })
  assignOrder(
    @Param('id') id: string,
    @Body() body: { userId: number },
  ) { return this.order.assignUser(+id, body.userId); }

  // ─── 聚推客订单（本地生活） ───

  @Get('jutuike/orders')
  @ApiOperation({ summary: '聚推客订单列表' })
  jutuikeOrders(@Query() q: any) {
    return this.order.listAll({
      platform: 'JTK',
      status: q.status ? +q.status : undefined,
      brandId: q.brandId ? +q.brandId : undefined,
      keyword: q.keyword || undefined,
      page: q.page ? +q.page : 1,
      size: q.pageSize ? +q.pageSize : 20,
    });
  }

  @Post('jutuike/sync')
  @ApiOperation({ summary: '手动同步聚推客订单' })
  jutuikeSync(@Body() body: { hours?: number }) {
    return this.jtk.syncOrders(body?.hours ?? 24);
  }

  @Get('users')
  @ApiOperation({ summary: '用户列表（后台用）' })
  users(
    @Query('keyword') keyword?: string,
    @Query('agentId') agentId?: string,
    @Query('minLevel') minLevel?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.agent.adminUserList({
      keyword: keyword || undefined,
      agentId: agentId ? +agentId : undefined,
      minLevel: minLevel ? +minLevel : undefined,
      page: +page,
      size: +pageSize,
    });
  }

  @Post('user/reset-password')
  @ApiOperation({ summary: '重置用户密码' })
  async resetUserPassword(@Body() body: { userId: number; newPassword?: string }) {
    if (!body.userId) throw new Error('缺少 userId');
    const user = await this.userRepo.findOneBy({ id: body.userId });
    if (!user) throw new Error('用户不存在');
    const newPwd = body.newPassword || this.genRandomPassword();
    user.password = bcrypt.hashSync(newPwd, 10);
    await this.userRepo.save(user);
    return { ok: true, newPassword: newPwd };
  }

  @Get('realnames')
  @ApiOperation({ summary: '实名认证列表' })
  realnames(
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const qb = this.userRepo.createQueryBuilder('u')
      .select(['u.id', 'u.mobile', 'u.nickname', 'u.realName', 'u.idCardNo', 'u.realNameStatus', 'u.realNameRemark', 'u.createdAt'])
      .orderBy('u.id', 'DESC');
    if (status && status !== '') {
      qb.andWhere('u.realNameStatus = :status', { status: +status });
    } else {
      // 没提交过的不显示
      qb.andWhere('u.realNameStatus > 0');
    }
    if (keyword) {
      qb.andWhere('(u.mobile LIKE :kw OR u.nickname LIKE :kw OR u.realName LIKE :kw)', { kw: `%${keyword}%` });
    }
    const p = +page, s = +pageSize;
    return qb
      .skip((p - 1) * s)
      .take(s)
      .getManyAndCount()
      .then(([list, total]) => ({ list, total }));
  }

  @Post('realname/:id/audit')
  @ApiOperation({ summary: '审核实名认证' })
  async auditRealname(
    @Param('id') id: string,
    @Body() body: { pass: boolean; remark?: string },
  ) {
    const user = await this.userRepo.findOneBy({ id: +id });
    if (!user) throw new Error('用户不存在');
    if (body.pass) {
      user.realNameStatus = 2;
      user.realNameRemark = body.remark || '';
    } else {
      user.realNameStatus = 3;
      user.realNameRemark = body.remark || '审核未通过';
    }
    await this.userRepo.save(user);
    return { ok: true };
  }

  private genRandomPassword(): string {
    // 8 位随机密码：字母 + 数字
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 8; i++) {
      p += chars[Math.floor(Math.random() * chars.length)];
    }
    return p;
  }
}
