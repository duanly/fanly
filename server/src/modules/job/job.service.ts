import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from '../order/order.service';
import { AgentService } from '../agent/agent.service';
import { FundService } from '../fund/fund.service';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly order: OrderService,
    private readonly agent: AgentService,
    private readonly fund: FundService,
  ) {}

  /** 增量拉单，每 10 分钟 */
  @Cron('0 */10 * * * *')
  async syncOrders() {
    const r = await this.order.syncAll(2);
    this.logger.log(`增量拉单: ${JSON.stringify(r)}`);
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
