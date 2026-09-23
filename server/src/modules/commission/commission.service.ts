import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Agent, Beneficiary, CommissionDetail, CommissionStatus,
  CpsOrder, LedgerType, OrderStatus, User,
} from '@/entities';
import { add, mul, sub, toNum } from '@/common/money';
import { SysConfigService } from '../admin/sys-config.service';
import { FundService } from '../fund/fund.service';

/**
 * 分佣引擎。
 *
 * 基数永远是"联盟实际结算给平台的金额"settleCommission，
 * 不是订单金额，也不是预估佣金 —— 这是返利平台最容易亏钱的地方。
 */
@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    @InjectRepository(CommissionDetail) private readonly detailRepo: Repository<CommissionDetail>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    private readonly ds: DataSource,
    private readonly cfg: SysConfigService,
    private readonly fund: FundService,
  ) {}

  /** 取某代理的分成比例：自定义优先，否则按等级模板 */
  private async agentRate(agentId: number | null): Promise<number> {
    if (!agentId) return 0;
    const agent = await this.agentRepo.findOneBy({ id: agentId });
    if (!agent || agent.status !== 1) return 0;
    if (agent.agentRate) return toNum(agent.agentRate);
    return this.cfg.num(`rebate.agent_rate.${agent.level}`, 0.1);
  }

  /** 试算：给前端展示"预计返 ¥X"，不落库 */
  async preview(estCommission: number, agentId: number | null = null) {
    const userRate = this.cfg.num('rebate.user_rate', 0.5);
    return {
      userRebate: Math.round(estCommission * userRate * 100) / 100,
      userRate,
      agentBonus: Math.round(estCommission * (await this.agentRate(agentId)) * 100) / 100,
    };
  }

  /**
   * 订单结算 → 生成三条分佣明细并入账。
   * 靠 commission_detail 的唯一键做幂等，重复跑不会多发钱。
   */
  async settleOrder(order: CpsOrder): Promise<boolean> {
    if (order.orderStatus !== OrderStatus.SETTLED) return false;
    if (!order.userId) {
      this.logger.warn(`订单 ${order.platformOrderNo} 无归属用户，分佣跳过`);
      return false;
    }
    const exist = await this.detailRepo.countBy({ orderId: order.id });
    if (exist > 0) return false;  // 幂等

    const base = toNum(order.settleCommission);
    if (base <= 0) return false;

    const userRate = this.cfg.num('rebate.user_rate', 0.5);
    const aRate = await this.agentRate(order.agentId);
    const userRebate = mul(base, userRate);
    const agentBonus = order.agentId ? mul(base, aRate) : '0.0000';
    const platformProfit = sub(sub(base, userRebate), agentBonus);

    await this.ds.transaction(async (m) => {
      const rows: Partial<CommissionDetail>[] = [
        {
          orderId: order.id, beneficiaryType: Beneficiary.USER, beneficiaryId: order.userId,
          baseAmount: String(base), rate: String(userRate), amount: userRebate,
          status: CommissionStatus.CREDITED,
        },
        {
          orderId: order.id, beneficiaryType: Beneficiary.PLATFORM, beneficiaryId: null,
          baseAmount: String(base), rate: String(1 - userRate - aRate), amount: platformProfit,
          status: CommissionStatus.CREDITED,
        },
      ];
      if (order.agentId) {
        rows.splice(1, 0, {
          orderId: order.id, beneficiaryType: Beneficiary.AGENT, beneficiaryId: order.agentId,
          baseAmount: String(base), rate: String(aRate), amount: agentBonus,
          status: CommissionStatus.CREDITED,
        });
      }
      await m.save(CommissionDetail, rows.map((r) => m.create(CommissionDetail, r)));

      // 用户返利入账，并从预估池里扣掉
      await this.fund.changeBalance(
        order.userId, userRebate, LedgerType.REBATE, order.id,
        `订单 ${order.platformOrderNo} 返利`, m,
      );
      const user = await m.findOneBy(User, { id: order.userId });
      user.pending = sub(user.pending, mul(order.estCommission, userRate));
      if (toNum(user.pending) < 0) user.pending = '0.0000';
      await m.save(User, user);

      // 代理分成入账
      if (order.agentId && toNum(agentBonus) > 0) {
        const agent = await m.findOneBy(Agent, { id: order.agentId });
        if (agent) {
          await this.fund.changeBalance(
            agent.userId, agentBonus, LedgerType.AGENT_BONUS, order.id,
            `团队订单 ${order.platformOrderNo} 分成`, m,
          );
        }
      }

      order.orderStatus = OrderStatus.CREDITED;
      await m.save(CpsOrder, order);
    });

    this.logger.log(
      `订单 ${order.platformOrderNo} 结算: 基数 ${base} → 用户 ${userRebate} / 代理 ${agentBonus} / 平台 ${platformProfit}`,
    );
    return true;
  }

  /**
   * 订单失效 → 冲销分佣。
   * 已入账的写反向流水，余额允许为负（下次返利先抵扣）。
   */
  async reverseOrder(order: CpsOrder): Promise<void> {
    const details = await this.detailRepo.find({ where: { orderId: order.id } });
    if (!details.length) return;

    await this.ds.transaction(async (m) => {
      for (const d of details) {
        if (d.status === CommissionStatus.REVERSED) continue;
        if (d.status === CommissionStatus.CREDITED && d.beneficiaryType !== Beneficiary.PLATFORM) {
          const targetUserId = d.beneficiaryType === Beneficiary.USER
            ? d.beneficiaryId
            : (await m.findOneBy(Agent, { id: d.beneficiaryId }))?.userId;
          if (targetUserId) {
            await this.fund.changeBalance(
              targetUserId, `-${d.amount}`, LedgerType.REVERSE, order.id,
              `订单 ${order.platformOrderNo} 失效冲销`, m,
            );
          }
        }
        d.status = CommissionStatus.REVERSED;
        await m.save(CommissionDetail, d);
      }
    });
    this.logger.warn(`订单 ${order.platformOrderNo} 已失效，分佣全部冲销`);
  }

  /** 代理业绩统计 */
  async agentStats(agentId: number, start?: Date, end?: Date) {
    const qb = this.ds.getRepository(CpsOrder).createQueryBuilder('o')
      .where('o.agentId = :agentId', { agentId });
    if (start) qb.andWhere('o.orderTime >= :start', { start });
    if (end) qb.andWhere('o.orderTime <= :end', { end });

    const orders = await qb.getMany();
    const valid = orders.filter((o) => o.orderStatus !== OrderStatus.INVALID);

    const details = await this.detailRepo.find({
      where: { beneficiaryType: Beneficiary.AGENT, beneficiaryId: agentId },
    });
    const sumBy = (s: number) => details
      .filter((d) => d.status === s)
      .reduce((acc, d) => add(acc, d.amount), '0.0000');

    return {
      orderCount: valid.length,
      invalidCount: orders.length - valid.length,
      gmv: valid.reduce((acc, o) => add(acc, o.payAmount), '0.0000'),
      pendingBonus: sumBy(CommissionStatus.PENDING),
      creditedBonus: sumBy(CommissionStatus.CREDITED),
      reversedBonus: sumBy(CommissionStatus.REVERSED),
    };
  }
}
