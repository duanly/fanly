import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CommissionDetail, CpsOrder, OrderStatus, PromotionPosition, User } from '@/entities';
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
    private readonly ds: DataSource,
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

      // 同时创建分佣预估明细（用户 + 一级代理 + 二级代理），
      // 代理可以在"待结算"里看到团队预估收益
      if (
        order.orderStatus === OrderStatus.PAID ||
        order.orderStatus === OrderStatus.RECEIVED
      ) {
        this.commission.pendingOrder(order).catch((e) =>
          this.logger.error(`创建预估分佣失败 ${order.platformOrderNo}: ${e.message}`),
        );
      }
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

      // 首次归属也创建预估分佣明细
      this.commission.pendingOrder(order).catch((e) =>
        this.logger.error(`首次归属创建预估分佣失败 ${order.platformOrderNo}: ${e.message}`),
      );
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

      // 同步更新预估分佣明细的金额
      this.commission.pendingOrder(order).catch((e) =>
        this.logger.error(`更新预估分佣失败 ${order.platformOrderNo}: ${e.message}`),
      );
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
  async listAll(q: { platform?: string; status?: number; agentId?: number; page?: number; size?: number; agentKeyword?: string; keyword?: string; userId?: number; brandId?: number; unassigned?: boolean }) {
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
    if (q.userId) qb.andWhere('o.userId = :userId', { userId: q.userId });
    if (q.unassigned) qb.andWhere('o.userId IS NULL');
    if (q.brandId) {
      // rawJson 是 simple-json（TEXT 存 JSON 字符串），用 MySQL JSON_EXTRACT 提取 brand_id
      qb.andWhere("JSON_EXTRACT(o.rawJson, '$.brand_id') = :brandId", { brandId: q.brandId });
    }
    if (q.keyword) {
      qb.andWhere('(o.platformOrderNo LIKE :kw OR o.goodsTitle LIKE :kw OR o.subOrderNo LIKE :kw)', {
        kw: `%${q.keyword}%`,
      });
    }
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

  /**
   * 手动指派订单归属人。
   *
   * 场景：用户通过推广链接进入，但因为种种原因（换了规格、跨店购买等）
   * 订单里没有 custom_parameters，导致系统无法自动归属。
   * 管理员核实后可以手动指派。
   *
   * 只改归属，不重新分佣——
   *   - 未结算订单：改 userId + agentId，同步更新双方 pending
   *   - 已结算/已入账：只改归属记录，分佣账不动（避免搞乱已结算的财务数据）
   *   - 已失效：只改记录
   */
  async assignUser(orderId: number, userId: number) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new Error('订单不存在');

    const targetUser = await this.userRepo.findOneBy({ id: userId });
    if (!targetUser) throw new Error('目标用户不存在');

    const prevUserId = order.userId;
    const userRate = this.cfg.num('rebate.user_rate', 0.5);

    // 如果订单在未结算状态，要调整两边的 pending
    const isPendingStatus =
      order.orderStatus === OrderStatus.PAID ||
      order.orderStatus === OrderStatus.RECEIVED;

    if (isPendingStatus) {
      const rebate = mul(order.estCommission, userRate);

      // 从原用户扣掉
      if (prevUserId) {
        const prevUser = await this.userRepo.findOneBy({ id: prevUserId });
        if (prevUser) {
          prevUser.pending = sub(prevUser.pending, rebate);
          if (toNum(prevUser.pending) < 0) prevUser.pending = '0.0000';
          await this.userRepo.save(prevUser);
        }
      }

      // 加到新用户
      targetUser.pending = add(targetUser.pending, rebate);
      await this.userRepo.save(targetUser);
    }

    // 更新订单归属
    order.userId = userId;
    order.agentId = targetUser.agentId ?? null;
    await this.orderRepo.save(order);

    // 未结算订单：同步重建双方的预估分佣明细（原用户的失效，新用户的创建）
    if (isPendingStatus) {
      try {
        await this.commission.pendingOrder(order);
      } catch (e: any) {
        this.logger.error(`指派订单后重建预估明细失败 ${order.platformOrderNo}: ${e.message}`);
      }
    }

    return { ok: true, orderId, userId, prevUserId };
  }

  /**
   * 重建所有未结算订单的预估分佣明细。
   * 用于上线时补历史数据，或数据错乱时一键修复。
   *
   * 会清理掉现有的 PENDING 明细然后重建，以当前 estCommission 为准。
   */
  async rebuildPendingDetails(): Promise<{ rebuilt: number; totalBonus: string }> {
    // 先清掉所有 PENDING 状态的明细（只清待结算的，已结算/已冲销的不动）
    await this.ds.getRepository(CommissionDetail)
      .createQueryBuilder()
      .delete()
      .where('status = :status', { status: 1 }) // CommissionStatus.PENDING = 1
      .execute();

    const qb = this.orderRepo.createQueryBuilder('o')
      .where('o.userId IS NOT NULL')
      .andWhere('o.orderStatus IN (:...statuses)', {
        statuses: [OrderStatus.PAID, OrderStatus.RECEIVED],
      });

    let rebuilt = 0;
    let totalBonus = '0.0000';
    let page = 1;
    const pageSize = 200;

    while (true) {
      const orders = await qb
        .orderBy('o.id', 'ASC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany();
      if (!orders.length) break;

      for (const order of orders) {
        try {
          await this.commission.pendingOrder(order);
          rebuilt++;
        } catch (e: any) {
          this.logger.error(`重建预估明细失败 ${order.platformOrderNo}: ${e.message}`);
        }
      }
      page++;
    }

    // 统计一下所有 PENDING 的代理分成总额
    const pendingSum = await this.ds.getRepository(CommissionDetail)
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amount), 0)', 'total')
      .where('d.beneficiaryType IN (:...types)', { types: [2, 4] }) // AGENT + AGENT_L2
      .andWhere('d.status = :status', { status: 1 }) // PENDING
      .getRawOne();
    totalBonus = pendingSum?.total || '0.0000';

    return { rebuilt, totalBonus };
  }
}
