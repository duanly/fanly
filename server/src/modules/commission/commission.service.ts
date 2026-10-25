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
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly ds: DataSource,
    private readonly cfg: SysConfigService,
    private readonly fund: FundService,
  ) {}

  /** 取某代理的分成比例：自定义优先，否则按等级模板 */
  private async agentRate(agentId: number | null): Promise<number> {
    if (!agentId) return 0;
    const agent = await this.agentRepo.findOneBy({ id: agentId });
    if (!agent || agent.status !== 1) return 0;
    // 预备代理（level=0）不算正式代理，没有团队分成
    if (agent.level <= 0) return 0;
    if (agent.agentRate) return toNum(agent.agentRate);
    return this.cfg.num(`rebate.agent_rate.${agent.level}`, agent.level === 3 ? 0.2 : agent.level === 2 ? 0.15 : 0.12);
  }

  /** 二级团队人数：我发展的代理，他们各自名下的用户总数（分档的依据） */
  async countTeamSizeL2(agentId: number): Promise<number> {
    const subAgents = await this.agentRepo.find({ where: { parentAgentId: agentId } });
    if (!subAgents.length) return 0;
    return this.userRepo.count({ where: subAgents.map((a) => ({ agentId: a.id })) });
  }

  /**
   * 某代理作为二级受益人的有效分成比例：
   * 手动配置优先（agentRateL2），否则按二级团队人数自动分档——
   * ≥30人 2% / ≥100人 3% / ≥500人 4%，不到门槛 0%。
   * 阈值与比例都能在系统参数里改。
   */
  async l2RateForAgent(agentId: number): Promise<number> {
    const agent = await this.agentRepo.findOneBy({ id: agentId });
    if (!agent) return 0;
    if (agent.agentRateL2 != null) {
      const manual = toNum(agent.agentRateL2);
      if (manual > 0) return manual;
    }
    const size = await this.countTeamSizeL2(agentId);
    if (size >= this.cfg.num('agent.l2.team_t3', 500)) return this.cfg.num('agent.l2.rate_t3', 0.04);
    if (size >= this.cfg.num('agent.l2.team_t2', 100)) return this.cfg.num('agent.l2.rate_t2', 0.03);
    if (size >= this.cfg.num('agent.l2.team_t1', 30)) return this.cfg.num('agent.l2.rate_t1', 0.02);
    return 0;
  }

  /**
   * 二级分成：直属代理的上级也能分一笔。
   * 县城熟人社会靠转介绍扩散，只给一级的话，介绍人没动力再去发展下线。
   * 比例走上级代理自己的「手动配置或团队人数自动档」，不再是全局一个值。
   */
  private async agentL2(agentId: number | null): Promise<{ id: number | null; rate: number }> {
    if (!agentId) return { id: null, rate: 0 };
    const l1 = await this.agentRepo.findOneBy({ id: agentId });
    if (!l1?.parentAgentId) return { id: null, rate: 0 };
    const l2 = await this.agentRepo.findOneBy({ id: l1.parentAgentId });
    if (!l2 || l2.status !== 1) return { id: null, rate: 0 };
    return { id: l2.id, rate: await this.l2RateForAgent(l2.id) };
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
   * 订单进入未结算状态（已付款/已收货）时，创建/更新预估分佣明细。
   * 代理可以在"待结算"里看到预期收益，增加推广动力。
   *
   * 幂等：按 (orderId, beneficiaryType, beneficiaryId) 唯一键 upsert。
   * 只动 PENDING 状态的明细，已结算/已冲销的不动。
   */
  async pendingOrder(order: CpsOrder): Promise<void> {
    if (!order.userId) return;

    const base = toNum(order.estCommission);
    if (base <= 0) return;

    const userRate = this.cfg.num('rebate.user_rate', 0.5);
    const aRate = await this.agentRate(order.agentId);
    const l2 = await this.agentL2(order.agentId);
    const userRebate = mul(base, userRate);
    const agentBonus = order.agentId ? mul(base, aRate) : '0.0000';
    const agentBonusL2 = l2.id ? mul(base, l2.rate) : '0.0000';
    const platformProfit = sub(sub(sub(base, userRebate), agentBonus), agentBonusL2);

    const rows: Partial<CommissionDetail>[] = [
      {
        orderId: order.id, beneficiaryType: Beneficiary.USER, beneficiaryId: order.userId,
        baseAmount: String(base), rate: String(userRate), amount: userRebate,
        status: CommissionStatus.PENDING,
      },
      {
        orderId: order.id, beneficiaryType: Beneficiary.PLATFORM, beneficiaryId: null,
        baseAmount: String(base), rate: String(1 - userRate - aRate), amount: platformProfit,
        status: CommissionStatus.PENDING,
      },
    ];
    if (order.agentId && toNum(agentBonus) > 0) {
      rows.splice(1, 0, {
        orderId: order.id, beneficiaryType: Beneficiary.AGENT, beneficiaryId: order.agentId,
        baseAmount: String(base), rate: String(aRate), amount: agentBonus,
        status: CommissionStatus.PENDING,
      });
    }
    if (l2.id && toNum(agentBonusL2) > 0) {
      rows.splice(2, 0, {
        orderId: order.id, beneficiaryType: Beneficiary.AGENT_L2, beneficiaryId: l2.id,
        baseAmount: String(base), rate: String(l2.rate), amount: agentBonusL2,
        status: CommissionStatus.PENDING,
      });
    }

    // upsert：已存在且是 PENDING 状态的就更新金额，已结算/已冲销的不动
    for (const row of rows) {
      const exist = await this.detailRepo.findOneBy({
        orderId: row.orderId!,
        beneficiaryType: row.beneficiaryType!,
        beneficiaryId: row.beneficiaryId ?? undefined,
      } as any);
      if (!exist) {
        await this.detailRepo.save(this.detailRepo.create(row));
      } else if (exist.status === CommissionStatus.PENDING) {
        exist.baseAmount = row.baseAmount!;
        exist.rate = row.rate!;
        exist.amount = row.amount!;
        await this.detailRepo.save(exist);
      }
    }
  }

  /**
   * 批量试算用户返利。
   * 排行榜/列表页一次返回几十件商品，逐个 preview 会产生 N+1 查询，
   * 这里一次性算好，省掉 N 次 DB 访问。
   */
  async batchUserRebate(items: { commission: number }[], _agentId: number | null = null): Promise<number[]> {
    const userRate = this.cfg.num('rebate.user_rate', 0.5);
    return items.map((it) => Math.round(Number(it.commission) * userRate * 100) / 100);
  }

  /**
   * 订单结算 → 生成三条分佣明细并入账。
   * 靠 commission_detail 的唯一键做幂等，重复跑不会多发钱。
   *
   * 如果之前已经有 PENDING 明细（下单时预生成的），就更新金额并改为 CREDITED；
   * 如果没有（历史订单或直接结算的），就新建。
   */
  async settleOrder(order: CpsOrder): Promise<boolean> {
    if (order.orderStatus !== OrderStatus.SETTLED) return false;
    if (!order.userId) {
      this.logger.warn(`订单 ${order.platformOrderNo} 无归属用户，分佣跳过`);
      return false;
    }
    // 先查是否已经结算过（幂等）
    const credited = await this.detailRepo.findOneBy({
      orderId: order.id,
      beneficiaryType: Beneficiary.USER,
      status: CommissionStatus.CREDITED,
    });
    if (credited) return false;

    const base = toNum(order.settleCommission);
    if (base <= 0) return false;

    const userRate = this.cfg.num('rebate.user_rate', 0.5);
    const aRate = await this.agentRate(order.agentId);
    const l2 = await this.agentL2(order.agentId);
    const userRebate = mul(base, userRate);
    const agentBonus = order.agentId ? mul(base, aRate) : '0.0000';
    const agentBonusL2 = l2.id ? mul(base, l2.rate) : '0.0000';
    const platformProfit = sub(sub(sub(base, userRebate), agentBonus), agentBonusL2);

    await this.ds.transaction(async (m) => {
      // 查现有的 PENDING 明细，结算时直接更新（保证 id 不变，幂等）
      const existDetails = await m.find(CommissionDetail, { where: { orderId: order.id } });
      const existMap = new Map<string, CommissionDetail>();
      for (const d of existDetails) {
        const key = `${d.beneficiaryType}_${d.beneficiaryId ?? 'null'}`;
        existMap.set(key, d);
      }

      const details: Partial<CommissionDetail>[] = [
        {
          beneficiaryType: Beneficiary.USER, beneficiaryId: order.userId,
          baseAmount: String(base), rate: String(userRate), amount: userRebate,
          status: CommissionStatus.CREDITED,
        },
        {
          beneficiaryType: Beneficiary.PLATFORM, beneficiaryId: null,
          baseAmount: String(base), rate: String(1 - userRate - aRate), amount: platformProfit,
          status: CommissionStatus.CREDITED,
        },
      ];
      if (order.agentId && toNum(agentBonus) > 0) {
        details.splice(1, 0, {
          beneficiaryType: Beneficiary.AGENT, beneficiaryId: order.agentId,
          baseAmount: String(base), rate: String(aRate), amount: agentBonus,
          status: CommissionStatus.CREDITED,
        });
      }
      if (l2.id && toNum(agentBonusL2) > 0) {
        details.splice(2, 0, {
          beneficiaryType: Beneficiary.AGENT_L2, beneficiaryId: l2.id,
          baseAmount: String(base), rate: String(l2.rate), amount: agentBonusL2,
          status: CommissionStatus.CREDITED,
        });
      }

      for (const d of details) {
        const key = `${d.beneficiaryType}_${d.beneficiaryId ?? 'null'}`;
        const exist = existMap.get(key);
        if (exist && exist.status === CommissionStatus.PENDING) {
          // 已有 PENDING：更新金额 + 状态
          exist.baseAmount = d.baseAmount!;
          exist.rate = d.rate!;
          exist.amount = d.amount!;
          exist.status = CommissionStatus.CREDITED;
          await m.save(CommissionDetail, exist);
        } else if (!exist) {
          // 没有：新建一条
          await m.save(CommissionDetail, m.create(CommissionDetail, { orderId: order.id, ...d }));
        }
        // 已存在且是 CREDITED：说明重复结算，跳过
      }

      // 用户返利入账，并从预估池里扣掉
      await this.fund.changeBalance(
        order.userId, userRebate, LedgerType.REBATE, order.id,
        `订单 ${order.platformOrderNo} 返利`, m,
      );
      const user = await m.findOneBy(User, { id: order.userId });
      if (user) {
        user.pending = sub(user.pending, mul(order.estCommission, userRate));
        if (toNum(user.pending) < 0) user.pending = '0.0000';
        await m.save(User, user);
      }

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
      // 二级分成入账
      if (l2.id && toNum(agentBonusL2) > 0) {
        const agent2 = await m.findOneBy(Agent, { id: l2.id });
        if (agent2) {
          await this.fund.changeBalance(
            agent2.userId, agentBonusL2, LedgerType.AGENT_BONUS, order.id,
            `二级团队订单 ${order.platformOrderNo} 分成`, m,
          );
        }
      }

      order.orderStatus = OrderStatus.CREDITED;
      await m.save(CpsOrder, order);
    });

    this.logger.log(
      `订单 ${order.platformOrderNo} 结算: 基数 ${base} → 用户 ${userRebate}`
      + ` / 一级 ${agentBonus} / 二级 ${agentBonusL2} / 平台 ${platformProfit}`,
    );
    return true;
  }

  /**
   * 订单失效 → 冲销分佣。
   * 已入账的写反向流水，余额允许为负（下次返利先抵扣）。
   * PENDING 状态的直接改成 REVERSED，不用动余额（还没入账）。
   */
  async reverseOrder(order: CpsOrder): Promise<void> {
    const details = await this.detailRepo.find({ where: { orderId: order.id } });
    if (!details.length) return;

    await this.ds.transaction(async (m) => {
      for (const d of details) {
        if (d.status === CommissionStatus.REVERSED) continue;
        if (d.status === CommissionStatus.PENDING) {
          // 还没入账的，直接标记为已冲销，不用动余额
          d.status = CommissionStatus.REVERSED;
          await m.save(CommissionDetail, d);
          continue;
        }
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
          d.status = CommissionStatus.REVERSED;
          await m.save(CommissionDetail, d);
        }
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
