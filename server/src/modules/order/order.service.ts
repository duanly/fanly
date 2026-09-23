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
    order.payAmount = String(u.payAmount);
    order.commissionRate = String(u.commissionRate);
    order.estCommission = String(u.estCommission);
    order.settleCommission = String(u.settleCommission || 0);
    order.settleTime = u.settleTime ?? order.settleTime;
    order.rawJson = u.raw ?? null;

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

  /** 后台用：全量列表 */
  async listAll(q: { platform?: string; status?: number; agentId?: number; page?: number; size?: number }) {
    const { page = 1, size = 20 } = q;
    const where: any = {};
    if (q.platform) where.platform = q.platform;
    if (q.status) where.orderStatus = q.status;
    if (q.agentId) where.agentId = q.agentId;
    const [list, total] = await this.orderRepo.findAndCount({
      where, order: { orderTime: 'DESC' }, skip: (page - 1) * size, take: size,
    });
    return { list, total, page, size };
  }
}
