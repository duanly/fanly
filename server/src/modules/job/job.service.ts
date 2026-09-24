import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from '../order/order.service';
import { AgentService } from '../agent/agent.service';
import { FundService } from '../fund/fund.service';
import { CurationService } from '../curation/curation.service';
import { CompareService } from '../cps/compare.service';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly order: OrderService,
    private readonly agent: AgentService,
    private readonly fund: FundService,
    private readonly curation: CurationService,
    private readonly compare: CompareService,
  ) {}

  /** 增量拉单，每 10 分钟 */
  @Cron('0 */10 * * * *')
  async syncOrders() {
    const r = await this.order.syncAll(2);
    this.logger.log(`增量拉单: ${JSON.stringify(r)}`);
  }

  /**
   * 比价组成员刷新，每 15 分钟。
   * 比价页摆的是「哪家最便宜」，价格一旧结论就可能是反的，
   * 所以这批比普通选品刷得勤得多。
   */
  @Cron('0 */15 * * * *')
  async refreshCompare() {
    const rows = await this.compare.members();
    if (!rows.length) return;
    const r = await this.curation.refreshCompareMembers(rows);
    this.logger.log(`比价组刷新: ${JSON.stringify(r)}`);
  }

  /**
   * 选品池刷新，每小时的第 5 分钟。
   * 错开整点，别和拉单挤在一起把平台接口打爆。
   */
  @Cron('0 5 * * * *')
  async refreshCuration() {
    const r = await this.curation.refreshAll();
    if (!r.total) return;
    this.logger.log(`选品池刷新: ${JSON.stringify(r)}`);
    if (r.expired) {
      this.logger.warn(`选品池有 ${r.expired} 件自动下架（佣金归零或已退出推广），去后台看看`);
    }
  }

  /** 全量对账，每日 03:00 */
  @Cron('0 0 3 * * *')
  async dailyReconcile() {
    await this.order.syncAll(24 * 30);
    const diff = await this.fund.reconcile();
    if (diff.length) this.logger.error(`对账不一致账号: ${JSON.stringify(diff)}`);
    else this.logger.log('对账通过');
  }

  /** 代理等级重算，每月 1 日 05:00 */
  @Cron('0 0 5 1 * *')
  async recalcAgentLevel() {
    await this.agent.recalcLevels();
    this.logger.log('代理等级已重算');
  }
}
