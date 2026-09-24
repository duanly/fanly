import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { Checkin, CoinLedger, CoinType, LedgerType, User } from '@/entities';
import { SysConfigService } from '../admin/sys-config.service';
import { FundService } from '../fund/fund.service';

/** 本地日期字符串，签到按自然日算，不按 UTC */
function today(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

@Injectable()
export class CoinService {
  private readonly logger = new Logger(CoinService.name);

  constructor(
    @InjectRepository(Checkin) private readonly checkinRepo: Repository<Checkin>,
    @InjectRepository(CoinLedger) private readonly ledgerRepo: Repository<CoinLedger>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly ds: DataSource,
    private readonly cfg: SysConfigService,
    private readonly fund: FundService,
  ) {}

  /** 金币余额的唯一变更入口，跟资金那套一个思路 */
  private async changeCoins(
    userId: number, amount: number, bizType: string, remark: string, m?: any,
  ) {
    const run = async (mgr: any) => {
      const user = await mgr.findOneBy(User, { id: userId });
      if (!user) throw new BadRequestException('用户不存在');
      const after = (user.coins ?? 0) + amount;
      if (after < 0) throw new BadRequestException('金币不够');
      user.coins = after;
      await mgr.save(User, user);
      await mgr.save(CoinLedger, mgr.create(CoinLedger, {
        userId, bizType, amount, balanceAfter: after, remark,
      }));
      return after;
    };
    return m ? run(m) : this.ds.transaction(run);
  }

  /**
   * 签到。
   * 连续天数按「昨天签没签」算；断了就从 1 重新开始。
   * 奖励 = 基础 + 连续天数 × 递增，封顶防止薅到天上去。
   */
  async checkin(userId: number) {
    const day = today();
    const exist = await this.checkinRepo.findOneBy({ userId, day });
    if (exist) {
      return { ...exist, already: true, coins: exist.coins };
    }

    const yesterday = await this.checkinRepo.findOneBy({ userId, day: today(-1) });
    const streak = (yesterday?.streak ?? 0) + 1;

    const base = this.cfg.num('coin.checkin_base', 10);
    const bonus = this.cfg.num('coin.checkin_streak_bonus', 5);
    const cap = this.cfg.num('coin.checkin_max', 50);
    const coins = Math.min(Math.round(base + (streak - 1) * bonus), cap);

    try {
      const row = await this.ds.transaction(async (m) => {
        const saved = await m.save(Checkin, m.create(Checkin, { userId, day, streak, coins }));
        await this.changeCoins(userId, coins, CoinType.CHECKIN, `签到第 ${streak} 天`, m);
        return saved;
      });
      return { ...row, already: false };
    } catch (e: any) {
      // 撞唯一键说明并发点了两下，按已签到处理，别报错吓人
      const again = await this.checkinRepo.findOneBy({ userId, day });
      if (again) return { ...again, already: true };
      throw e;
    }
  }

  /** 签到状态 + 本月日历，给前端画打卡图 */
  async status(userId: number) {
    const day = today();
    const user = await this.userRepo.findOneBy({ id: userId });
    const mine = await this.checkinRepo.findOneBy({ userId, day });

    const monthStart = day.slice(0, 8) + '01';
    const rows = await this.checkinRepo.find({
      where: { userId, day: Between(monthStart, day) },
      order: { day: 'ASC' },
    });

    const rate = this.cfg.num('coin.exchange_rate', 100);
    const min = this.cfg.num('coin.exchange_min', 1000);
    const coins = user?.coins ?? 0;

    return {
      today: day,
      checked: !!mine,
      todayCoins: mine?.coins ?? 0,
      streak: mine?.streak ?? (await this.checkinRepo.findOneBy({ userId, day: today(-1) }))?.streak ?? 0,
      coins,
      days: rows.map((r) => r.day),
      // 明天签能得多少，摆出来才有人愿意连着签
      nextCoins: Math.min(
        Math.round(this.cfg.num('coin.checkin_base', 10)
          + (mine?.streak ?? 0) * this.cfg.num('coin.checkin_streak_bonus', 5)),
        this.cfg.num('coin.checkin_max', 50),
      ),
      exchangeRate: rate,
      exchangeMin: min,
      exchangeable: Math.floor(coins / rate * 100) / 100,
    };
  }

  /** 金币换余额。这是金币唯一跨到资金账的口子 */
  async exchange(userId: number, coins: number) {
    const rate = this.cfg.num('coin.exchange_rate', 100);
    const min = this.cfg.num('coin.exchange_min', 1000);
    const n = Math.floor(coins);

    if (n < min) throw new BadRequestException(`至少 ${min} 金币才能兑换`);
    if (n % rate !== 0) throw new BadRequestException(`兑换数量要是 ${rate} 的整数倍`);

    const money = Math.round((n / rate) * 100) / 100;
    await this.ds.transaction(async (m) => {
      await this.changeCoins(userId, -n, CoinType.EXCHANGE, `兑换 ${money} 元`, m);
      await this.fund.changeBalance(
        userId, String(money), LedgerType.ADJUST, null,
        `${n} 金币兑换`, m,
      );
    });
    this.logger.log(`用户 ${userId} 用 ${n} 金币换了 ${money} 元`);
    return { coins: n, money };
  }

  async ledger(userId: number, page = 1, size = 20) {
    const [list, total] = await this.ledgerRepo.findAndCount({
      where: { userId }, order: { id: 'DESC' },
      skip: (page - 1) * size, take: size,
    });
    return { list, total, page };
  }
}
