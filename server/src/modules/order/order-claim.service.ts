import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ClaimStatus, CpsOrder, OrderClaim, OrderStatus, User } from '@/entities';
import { CommissionService } from '../commission/commission.service';

/** 重试这么多次还匹配不上，就不再自动重试了，转人工 */
const MAX_RETRY = 24;

@Injectable()
export class OrderClaimService {
  private readonly logger = new Logger(OrderClaimService.name);

  constructor(
    @InjectRepository(OrderClaim) private readonly repo: Repository<OrderClaim>,
    @InjectRepository(CpsOrder) private readonly orderRepo: Repository<CpsOrder>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly commission: CommissionService,
  ) {}

  private clean(no: string) {
    // 用户常常连空格、换行、「订单号：」一起粘进来
    return (no || '').replace(/[^0-9A-Za-z_-]/g, '').trim();
  }

  /**
   * 把订单绑到用户身上。
   * 订单已经结算过了就立刻分佣——用户等了这么久，不该再等下一个结算周期。
   */
  private async bind(order: CpsOrder, userId: number) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('用户不存在');

    order.userId = userId;
    order.agentId = user.agentId ?? null;
    await this.orderRepo.save(order);

    if (order.orderStatus === OrderStatus.SETTLED) {
      await this.commission.settleOrder(order);
    }
    return order;
  }

  /**
   * 尝试匹配一条找回申请。
   * 返回处理结果，调用方决定是保存还是继续等。
   */
  private async tryMatch(claim: OrderClaim): Promise<{
    status: number; reason: string; orderId?: number;
  }> {
    const order = await this.orderRepo.findOne({
      where: { platform: claim.platform, platformOrderNo: claim.platformOrderNo },
    });

    if (!order) {
      return {
        status: ClaimStatus.PENDING,
        reason: '还没查到这笔订单，可能平台还没同步过来，我们会继续帮你找',
      };
    }
    if (order.userId === claim.userId) {
      return { status: ClaimStatus.APPROVED, reason: '这笔订单本来就是你的', orderId: order.id };
    }
    if (order.userId) {
      // 归属明确的订单不能抢，否则就是给了刷单的口子
      return { status: ClaimStatus.REJECTED, reason: '这笔订单已归属其他账号，无法找回' };
    }

    await this.bind(order, claim.userId);
    return { status: ClaimStatus.APPROVED, reason: '已找回并归入你的账号', orderId: order.id };
  }

  async apply(userId: number, dto: {
    platform: string; platformOrderNo: string;
    goodsTitle?: string; payAmount?: number; orderDate?: string; remark?: string;
  }) {
    const platform = (dto.platform || '').toUpperCase();
    const no = this.clean(dto.platformOrderNo);
    if (!platform || !no) throw new BadRequestException('平台和订单号都要填');

    const exist = await this.repo.findOneBy({ platform, platformOrderNo: no });
    if (exist) {
      if (exist.userId === userId) {
        return { ...exist, duplicated: true };
      }
      throw new BadRequestException('这个订单号已经有人提交过了');
    }

    const claim = this.repo.create({
      userId, platform, platformOrderNo: no,
      goodsTitle: dto.goodsTitle ?? '',
      payAmount: String(dto.payAmount ?? 0),
      orderDate: dto.orderDate ? new Date(dto.orderDate) : null,
      remark: dto.remark ?? '',
      status: ClaimStatus.PENDING,
    });

    // 提交即尝试匹配 —— 能当场解决的就别让用户等人工
    const r = await this.tryMatch(claim);
    claim.status = r.status;
    claim.resultReason = r.reason;
    claim.matchedOrderId = r.orderId ?? null;
    if (r.status !== ClaimStatus.PENDING) claim.auditTime = new Date();

    const saved = await this.repo.save(claim);
    this.logger.log(`订单找回 ${platform}/${no} 用户${userId} → ${r.reason}`);
    return saved;
  }

  async listByUser(userId: number, page = 1, size = 20) {
    const [list, total] = await this.repo.findAndCount({
      where: { userId }, order: { id: 'DESC' },
      skip: (page - 1) * size, take: size,
    });
    return { total, page, list };
  }

  async adminList(status?: number, page = 1, size = 20) {
    const where: any = {};
    if (status !== undefined) where.status = status;
    const [list, total] = await this.repo.findAndCount({
      where, order: { status: 'ASC', id: 'DESC' },
      skip: (page - 1) * size, take: size,
    });
    return { total, page, list };
  }

  /** 后台人工裁决。通过时会再匹配一次，匹配不上就说明订单确实不存在 */
  async audit(id: number, pass: boolean, adminId: number, reason?: string) {
    const claim = await this.repo.findOneBy({ id });
    if (!claim) throw new NotFoundException('申请不存在');

    if (!pass) {
      claim.status = ClaimStatus.REJECTED;
      claim.resultReason = reason || '经核实无法找回';
    } else {
      const r = await this.tryMatch(claim);
      if (r.status === ClaimStatus.PENDING) {
        // 人工点了通过但订单真的不在，如实告诉后台，别假装成功
        claim.resultReason = '系统里查不到这笔订单，无法自动归属；'
          + '确需补偿请到「资金」里手工调帐';
        claim.status = ClaimStatus.REJECTED;
      } else {
        claim.status = r.status;
        claim.resultReason = r.reason;
        claim.matchedOrderId = r.orderId ?? null;
      }
    }
    claim.auditBy = adminId;
    claim.auditTime = new Date();
    return this.repo.save(claim);
  }

  /**
   * 定时重试待处理的申请。
   * 各平台拉单都有延迟，用户提交时订单往往还没同步回来，
   * 过一会儿再试就成了——这能把大部分找回变成全自动。
   */
  async retryPending() {
    const rows = await this.repo.find({
      where: { status: ClaimStatus.PENDING, retryCount: LessThan(MAX_RETRY) },
      take: 200,
    });
    const stat = { total: rows.length, approved: 0, rejected: 0, still: 0 };
    for (const claim of rows) {
      const r = await this.tryMatch(claim);
      claim.retryCount += 1;
      claim.resultReason = r.reason;
      if (r.status !== ClaimStatus.PENDING) {
        claim.status = r.status;
        claim.matchedOrderId = r.orderId ?? null;
        claim.auditTime = new Date();
        if (r.status === ClaimStatus.APPROVED) stat.approved += 1;
        else stat.rejected += 1;
      } else {
        stat.still += 1;
        if (claim.retryCount >= MAX_RETRY) {
          claim.resultReason = '一直没查到这笔订单，请联系客服人工核实';
        }
      }
      await this.repo.save(claim);
    }
    return stat;
  }
}
