import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FundLedger, LedgerType, User, Withdraw, WithdrawStatus } from '@/entities';
import { add, gte, sub, toNum } from '@/common/money';
import { genOutTradeNo } from '@/common/code';
import { SysConfigService } from '../admin/sys-config.service';

@Injectable()
export class FundService {
  private readonly logger = new Logger(FundService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(FundLedger) private readonly ledgerRepo: Repository<FundLedger>,
    @InjectRepository(Withdraw) private readonly wdRepo: Repository<Withdraw>,
    private readonly ds: DataSource,
    private readonly cfg: SysConfigService,
  ) {}

  /**
   * 唯一的余额变动入口。任何改余额的地方都必须走这里，
   * 保证 fund_ledger 与 user.balance 永远对得上。
   */
  async changeBalance(
    userId: number, amount: string | number, bizType: LedgerType,
    bizId: number | null, remark: string, manager?: any,
  ): Promise<FundLedger> {
    // SQLite 不支持行锁；MySQL 下用 FOR UPDATE 防并发改余额
    const canLock = this.ds.options.type === 'mysql';
    const run = async (m: any) => {
      const user = canLock
        ? await m.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } })
        : await m.findOneBy(User, { id: userId });
      if (!user) throw new BadRequestException(`用户 ${userId} 不存在`);

      const after = add(user.balance, amount);
      user.balance = after;
      if (toNum(amount) > 0) user.totalRebate = add(user.totalRebate, amount);
      await m.save(User, user);

      const ledger = m.create(FundLedger, {
        userId, bizType, bizId,
        amount: String(amount), balanceAfter: after, remark,
      });
      return m.save(FundLedger, ledger);
    };
    return manager ? run(manager) : this.ds.transaction(run);
  }

  async balance(userId: number) {
    const u = await this.userRepo.findOneBy({ id: userId });
    return {
      balance: u.balance,       // 可提现
      frozen: u.frozen,         // 提现冻结中
      pending: u.pending,       // 预估返利，订单未结算
      totalRebate: u.totalRebate,
    };
  }

  async ledger(userId: number, page = 1, size = 20, bizType?: string) {
    // 筛选必须在数据库做：前端过滤会让分页的 total 对不上，
    // van-list 判断不出「到底了」，一直往下翻空页
    const where: any = { userId };
    if (bizType) where.bizType = bizType;
    const [list, total] = await this.ledgerRepo.findAndCount({
      where, order: { id: 'DESC' },
      skip: (page - 1) * size, take: size,
    });
    return { list, total, page, size };
  }

  /**
   * 我的提现记录。
   * 光看资金流水只知道扣了多少钱，看不到「审核中/已打款/被驳回」，
   * 这是用户最容易来问的东西，单独给一个列表。
   */
  async myWithdraws(userId: number, page = 1, size = 20) {
    const [rows, total] = await this.wdRepo.findAndCount({
      where: { userId }, order: { id: 'DESC' },
      skip: (page - 1) * size, take: size,
    });
    return {
      total, page, size,
      list: rows.map((w) => ({
        id: w.id,
        amount: toNum(w.amount),
        fee: toNum(w.fee),
        // 到手 = 申请金额 - 手续费，界面上直接显示，别让用户自己算
        received: Math.round((toNum(w.amount) - toNum(w.fee)) * 100) / 100,
        channel: w.channel,
        accountInfo: w.accountInfo,
        status: w.status,
        failReason: w.failReason,
        channelOrderNo: w.channelOrderNo,
        createdAt: w.createdAt,
        auditTime: w.auditTime,
      })),
    };
  }

  /**
   * 收益概览。
   * 「我的」页顶部那几个数字，以及本月的进出。
   * 全部从 fund_ledger 算，跟对账用的是同一个数据源，不会出现两处对不上。
   */
  async summary(userId: number) {
    const u = await this.userRepo.findOneBy({ id: userId });
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const sumSince = async (types: string[], since?: Date) => {
      const qb = this.ledgerRepo
        .createQueryBuilder('l')
        .select('COALESCE(SUM(l.amount), 0)', 'v')
        .where('l.userId = :userId', { userId })
        .andWhere('l.bizType IN (:...types)', { types });
      if (since) qb.andWhere('l.createdAt >= :since', { since });
      const r = await qb.getRawOne();
      return Math.round(Number(r?.v ?? 0) * 100) / 100;
    };

    const EARN = [LedgerType.REBATE, LedgerType.AGENT_BONUS];
    const [monthEarned, totalEarned, monthWithdraw] = await Promise.all([
      sumSince(EARN, monthStart),
      sumSince(EARN),
      sumSince([LedgerType.WITHDRAW], monthStart),
    ]);

    return {
      balance: toNum(u.balance),
      frozen: toNum(u.frozen),
      pending: toNum(u.pending),
      totalRebate: toNum(u.totalRebate),
      /** 本月已到账（返利 + 团队分成，冲销已经是负数会自动抵掉） */
      monthEarned,
      totalEarned,
      /** 本月提现，流水里是负数，这里翻正方便展示 */
      monthWithdraw: Math.abs(monthWithdraw),
    };
  }

  /** 提现申请：手续费按通道实收透传，不加价 */
  async applyWithdraw(userId: number, amount: number, channel: string, accountInfo: string) {
    const min = this.cfg.num('withdraw.min', 10);
    const max = this.cfg.num('withdraw.max', 800);
    if (amount < min) throw new BadRequestException(`最低提现 ${min} 元`);
    if (amount > max) throw new BadRequestException(`单笔上限 ${max} 元`);

    const daily = this.cfg.num('withdraw.daily_limit', 1);
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const todayCount = await this.wdRepo.count({ where: { userId } });
    if (daily > 0 && todayCount > 0) {
      const today = await this.ds.getRepository(Withdraw)
        .createQueryBuilder('w')
        .where('w.userId = :userId AND w.createdAt >= :since', { userId, since })
        .getCount();
      if (today >= daily) throw new BadRequestException(`每日最多提现 ${daily} 次`);
    }

    const feeRate = this.cfg.num('withdraw.fee_rate', 0);
    const feeFixed = this.cfg.num('withdraw.fee_fixed', 0);
    const fee = Math.round((amount * feeRate + feeFixed) * 100) / 100;

    return this.ds.transaction(async (m) => {
      const user = await m.findOneBy(User, { id: userId });
      if (!gte(user.balance, amount)) throw new BadRequestException('余额不足');

      // 余额扣到冻结，走流水
      user.balance = sub(user.balance, amount);
      user.frozen = add(user.frozen, amount);
      await m.save(User, user);

      const wd = await m.save(Withdraw, m.create(Withdraw, {
        userId, amount: String(amount), fee: String(fee), channel, accountInfo,
        outTradeNo: genOutTradeNo(), status: WithdrawStatus.AUDITING,
      }));

      await m.save(FundLedger, m.create(FundLedger, {
        userId, bizType: LedgerType.WITHDRAW, bizId: wd.id,
        amount: String(-amount), balanceAfter: user.balance,
        remark: `提现申请 #${wd.id}，手续费 ${fee} 元`,
      }));
      return wd;
    });
  }

  /** 后台审核：通过进入打款队列，驳回把钱退回余额 */
  async auditWithdraw(id: number, pass: boolean, adminId: number, reason = '') {
    return this.ds.transaction(async (m) => {
      const wd = await m.findOneBy(Withdraw, { id });
      if (!wd || wd.status !== WithdrawStatus.AUDITING) {
        throw new BadRequestException('提现单状态不可审核');
      }
      wd.auditBy = adminId; wd.auditTime = new Date();
      if (pass) {
        wd.status = WithdrawStatus.APPROVED;
      } else {
        wd.status = WithdrawStatus.REJECTED;
        wd.failReason = reason;
        const user = await m.findOneBy(User, { id: wd.userId });
        user.frozen = sub(user.frozen, wd.amount);
        user.balance = add(user.balance, wd.amount);
        await m.save(User, user);
        await m.save(FundLedger, m.create(FundLedger, {
          userId: wd.userId, bizType: LedgerType.WITHDRAW_REFUND, bizId: wd.id,
          amount: wd.amount, balanceAfter: user.balance, remark: `提现驳回退回：${reason}`,
        }));
      }
      return m.save(Withdraw, wd);
    });
  }

  /** 打款结果回调（真实通道接入后由支付回调调用） */
  async finishWithdraw(id: number, success: boolean, channelOrderNo = '', failReason = '') {
    return this.ds.transaction(async (m) => {
      const wd = await m.findOneBy(Withdraw, { id });
      if (!wd || ![WithdrawStatus.APPROVED, WithdrawStatus.PAYING].includes(wd.status)) return wd;
      const user = await m.findOneBy(User, { id: wd.userId });
      if (success) {
        wd.status = WithdrawStatus.SUCCESS;
        wd.channelOrderNo = channelOrderNo;
        user.frozen = sub(user.frozen, wd.amount);   // 冻结直接核销
        await m.save(User, user);
      } else {
        wd.status = WithdrawStatus.FAILED;
        wd.failReason = failReason;
        user.frozen = sub(user.frozen, wd.amount);
        user.balance = add(user.balance, wd.amount);
        await m.save(User, user);
        await m.save(FundLedger, m.create(FundLedger, {
          userId: wd.userId, bizType: LedgerType.WITHDRAW_REFUND, bizId: wd.id,
          amount: wd.amount, balanceAfter: user.balance, remark: `打款失败退回：${failReason}`,
        }));
      }
      return m.save(Withdraw, wd);
    });
  }

  /** 每日对账：用流水重放余额，不一致就告警 */
  async reconcile(): Promise<{ userId: number; balance: string; replayed: string }[]> {
    // 用 QueryBuilder 而不是裸 SQL：amount 本身是 DECIMAL，不需要 CAST，
    // 各数据库的 CAST 目标类型写法不一样（SQLite 的 REAL 在 MySQL 里就是语法错误）
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin(FundLedger, 'l', 'l.userId = u.id')
      .select('u.id', 'userId')
      .addSelect('u.balance', 'balance')
      .addSelect('COALESCE(SUM(l.amount), 0)', 'replayed')
      .groupBy('u.id')
      .getRawMany();
    return rows
      .filter((r: any) => Math.abs(toNum(r.balance) - toNum(r.replayed)) > 0.0001)
      .map((r: any) => ({ userId: r.userId, balance: r.balance, replayed: String(r.replayed) }));
  }
}
