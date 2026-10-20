import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CpsOrder, OrderStatus, PromotionPosition, User } from '@/entities';
import { UnifiedOrder } from '../cps/cps.types';
import { CpsService, PLATFORMS } from '../cps/cps.service';
import { CommissionService } from '../commission/commission.service';
import { SysConfigService } from '../admin/sys-config.service';
import { add, mul, sub, toNum } from '@/common/money';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(CpsOrder) private readonly orderRepo: Repository<CpsOrder>,
    @InjectRepository(PromotionPosition) private readonly posRepo: Repository<PromotionPosition>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly cps: CpsService,
    private readonly commission: CommissionService,
    private readonly cfg: SysConfigService,
  ) {}

  /** 反解子渠道参数 → 用户 */
  private async resolveUser(platform: string, positionId: string): Promise<User | null> {
    if (!positionId) return null;
    const pos = await this.posRepo.findOneBy({ platform, positionId });
    return pos ? this.userRepo.findOneBy({ id: pos.userId }) : null;
  }

  /**
   * 落库一笔订单。唯一键 upsert，重复拉取不会重复分佣。
   * 状态流转全部集中在这里，业务其他地方不准直接改 orderStatus。
   */
  async upsert(u: UnifiedOrder): Promise<CpsOrder> {
    let order = await this.orderRepo.findOneBy({
      platform: u.platform,
      platformOrderNo: u.platformOrderNo,
      subOrderNo: u.subOrderNo || '',
    });

    // 打印原始报文，方便排查状态映射问题
    if (u.raw) {
      this.logger.log(
        `[订单原始报文] ${u.platform} ${u.platformOrderNo} `
        + `raw_status=${u.raw.tk_status ?? u.raw.order_status ?? u.raw.status ?? u.raw.orderStatus ?? u.raw.validCode ?? '?'} `
        + `mapped_status=${u.status} `
        + `est=${u.estCommission} pay=${u.payAmount}`,
      );
    }

    const isNew = !order;
    if (!order) {
      const user = await this.resolveUser(u.platform, u.positionId);
      order = this.orderRepo.create({
        platform: u.platform,
        platformOrderNo: u.platformOrderNo,
        subOrderNo: u.subOrderNo || '',
        userId: user?.id ?? null,
        agentId: user?.agentId ?? null,   // 下单时快照，之后改绑不影响
        goodsId: u.goodsId,
        goodsTitle: u.goodsTitle,
        goodsImg: u.goodsImg,
        orderTime: u.orderTime,
      });
    }

    const prevStatus = order.orderStatus;
    const prevEstCommission = order.estCommission;
    const prevUserId = order.userId;
    order.payAmount = String(u.payAmount);
    order.commissionRate = String(u.commissionRate);
    order.estCommission = String(u.estCommission);
    order.settleCommission = String(u.settleCommission || 0);
    order.settleTime = u.settleTime ?? order.settleTime;
    order.rawJson = u.raw ?? null;

    // 老订单首次归属：之前 userId 为 null，这次解析出了用户
    if (!isNew && !prevUserId) {
      const user = await this.resolveUser(u.platform, u.positionId);
      if (user) {
        order.userId = user.id;
        order.agentId = user.agentId ?? null;
      }
    }

    // 已入账的订单不再被平台状态回退，只认"转失效"
    if (prevStatus === OrderStatus.CREDITED && u.status !== 4) {
      await this.orderRepo.save(order);
      return order;
    }
    order.orderStatus = u.status;
    await this.orderRepo.save(order);

    // 新订单：把预估返利挂到用户 pending，前端显示"预估返 ¥X"
    if (isNew && order.userId) {
      const userRate = this.cfg.num('rebate.user_rate', 0.5);
      const user = await this.userRepo.findOneBy({ id: order.userId });
      user.pending = add(user.pending, mul(order.estCommission, userRate));
      await this.userRepo.save(user);
    }

    // 老订单首次归属：之前无主，这次才归属到用户，补上 pending
    if (
      !isNew && !prevUserId && order.userId &&
      order.orderStatus !== OrderStatus.SETTLED &&
      order.orderStatus !== OrderStatus.CREDITED &&
      order.orderStatus !== OrderStatus.INVALID
    ) {
      const userRate = this.cfg.num('rebate.user_rate', 0.5);
      const user = await this.userRepo.findOneBy({ id: order.userId });
      user.pending = add(user.pending, mul(order.estCommission, userRate));
      await this.userRepo.save(user);
    }

    // 老订单：estCommission 变了且订单还在未结算状态，同步更新 pending
    if (
      !isNew && order.userId &&
      prevEstCommission !== order.estCommission &&
      (order.orderStatus === OrderStatus.PAID || order.orderStatus === OrderStatus.RECEIVED)
    ) {
      const userRate = this.cfg.num('rebate.user_rate', 0.5);
      const user = await this.userRepo.findOneBy({ id: order.userId });
      const diff = sub(mul(order.estCommission, userRate), mul(prevEstCommission, userRate));
      user.pending = add(user.pending, diff);
      if (toNum(user.pending) < 0) user.pending = '0.0000';
      await this.userRepo.save(user);
    }

    if (u.status === OrderStatus.SETTLED) {
      await this.commission.settleOrder(order);
    } else if (u.status === OrderStatus.INVALID && prevStatus !== OrderStatus.INVALID) {
      await this.commission.reverseOrder(order);
      if (order.userId) {
        const userRate = this.cfg.num('rebate.user_rate', 0.5);
        const user = await this.userRepo.findOneBy({ id: order.userId });
        user.pending = sub(user.pending, mul(order.estCommission, userRate));
        if (toNum(user.pending) < 0) user.pending = '0.0000';
        await this.userRepo.save(user);
      }
    }
    return order;
  }

  /** 定时任务调用：增量拉取所有平台订单 */
  async syncAll(hours = 2): Promise<{ platform: string; count: number }[]> {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600_000);
    const result = [];
    for (const platform of PLATFORMS) {
      try {
        const orders = await this.cps.fetchOrders(platform, start, end);
        for (const o of orders) await this.upsert(o);
        result.push({ platform, count: orders.length });
      } catch (e) {
        this.logger.error(`${platform} 拉单失败: ${e.message}`);
        result.push({ platform, count: -1 });
      }
    }
    return result;
  }

  async listByUser(userId: number, status?: number, page = 1, size = 20) {
    const where: any = { userId };
    if (status) where.orderStatus = status;
    const [list, total] = await this.orderRepo.findAndCount({
      where, order: { orderTime: 'DESC' }, skip: (page - 1) * size, take: size,
    });
    const userRate = this.cfg.num('rebate.user_rate', 0.5);
    return {
      list: list.map((o) => ({
        ...o,
        myRebate: mul(
          o.orderStatus >= OrderStatus.SETTLED ? o.settleCommission : o.estCommission,
          userRate,
        ),
      })),
      total, page, size,
    };
  }

  /** 后台用：全量列表，带用户昵称/手机和代理信息 */
  async listAll(q: { platform?: string; status?: number; agentId?: number; page?: number; size?: number; agentKeyword?: string }) {
    const { page = 1, size = 20 } = q;
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoin('user', 'u', 'u.id = o.userId')
      .leftJoin('agent', 'a', 'a.id = o.agentId')
      .leftJoin('user', 'au', 'au.id = a.userId')
      .addSelect('u.nickname', 'userNickname')
      .addSelect('u.mobile', 'userMobile')
      .addSelect('a.agentCode', 'agentCode')
      .addSelect('a.realName', 'agentRealName')
      .addSelect('a.level', 'agentLevel')
      .addSelect('au.nickname', 'agentNickname');
    if (q.platform) qb.andWhere('o.platform = :platform', { platform: q.platform });
    if (q.status) qb.andWhere('o.orderStatus = :status', { status: q.status });
    if (q.agentId) qb.andWhere('o.agentId = :agentId', { agentId: q.agentId });
    if (q.agentKeyword) {
      qb.andWhere('(a.agentCode LIKE :kw OR a.realName LIKE :kw OR au.nickname LIKE :kw)', { kw: `%${q.agentKeyword}%` });
    }
    qb.orderBy('o.orderTime', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const [entities, total] = await qb.getManyAndCount();
    const rawList = await qb.getRawMany();
    const list = entities.map((entity, i) => ({
      ...entity,
      userNickname: rawList[i]?.userNickname || null,
      userMobile: rawList[i]?.userMobile || null,
      agentCode: rawList[i]?.agentCode || null,
      agentRealName: rawList[i]?.agentRealName || null,
      agentLevel: rawList[i]?.agentLevel != null ? Number(rawList[i].agentLevel) : null,
      agentNickname: rawList[i]?.agentNickname || null,
    }));
    return { list, total, page, size };
  }

  /**
   * 重算所有用户的 pending（预估返利池）。
   * 历史原因导致 pending 不准时（比如订单首次归属延迟、estCommission 变更等），
   * 用这个方法一键修复。以未结算（PAID/RECEIVED）且有归属的订单为基准重算。
   */
  async recalcPending(): Promise<{ fixed: number; totalPending: string }> {
    const userRate = this.cfg.num('rebate.user_rate', 0.5);
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.userId', 'userId')
      .addSelect('COALESCE(SUM(o.estCommission), 0)', 'totalEst')
      .where('o.userId IS NOT NULL')
      .andWhere('o.orderStatus IN (:...statuses)', { statuses: [OrderStatus.PAID, OrderStatus.RECEIVED] })
      .groupBy('o.userId')
      .getRawMany();

    let fixed = 0;
    let totalPending = '0.0000';
    for (const row of rows) {
      const userId = Number(row.userId);
      const expected = mul(String(row.totalEst), userRate);
      const user = await this.userRepo.findOneBy({ id: userId });
      if (!user) continue;
      if (toNum(user.pending) !== toNum(expected)) {
        user.pending = expected;
        await this.userRepo.save(user);
        fixed += 1;
      }
      totalPending = add(totalPending, expected);
    }
    return { fixed, totalPending };
  }
}
