import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from '../order/order.service';
import { AgentService } from '../agent/agent.service';
import { FundService } from '../fund/fund.service';
import { CurationService } from '../curation/curation.service';
import { CompareService } from '../cps/compare.service';
import { OrderClaimService } from '../order/order-claim.service';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly order: OrderService,
    private readonly agent: AgentService,
    private readonly fund: FundService,
    private readonly curation: CurationService,
    private readonly compare: CompareService,
    private readonly claim: OrderClaimService,
  ) {}

  /** 增量拉单，每 10 分钟 */
  @Cron('0 */10 * * * *')
  async syncOrders() {
    const r = await this.order.syncAll(2);
    this.logger.log(`增量拉单: ${JSON.stringify(r)}`);
  }

  /**
   * 订单找回重试，每 10 分钟，紧跟在拉单后面。
   * 用户提交时订单往往还没同步回来，拉完单立刻再匹配一次，
   * 大部分找回就能变成全自动，不用惊动客服。
   */
  @Cron('0 2-59/10 * * * *')
  async retryClaims() {
    const r = await this.claim.retryPending();
    if (!r.total) return;
    this.logger.log(`订单找回重试: ${JSON.stringify(r)}`);
  }

  /**
   * 比价组成员刷新，每 2 小时。
   * 比价页摆的是「哪家最便宜」，价格一旧结论就可能是反的，
   * 所以比普通选品刷得勤，但也没必要 15 分钟那么勤——
   * 一来平台接口扛不住，二来大部分商品价格一天都不变。
   */
  @Cron('0 15 */2 * * *')
  async refreshCompare() {
    const rows = await this.compare.members();
    if (!rows.length) return;
    const r = await this.curation.refreshCompareMembers(rows);
    this.logger.log(`比价组刷新: ${JSON.stringify(r)}`);
  }

  /**
   * 选品池刷新，每 6 小时（01:05 / 07:05 / 13:05 / 19:05）。
   *
   * 之前每 30 分钟刷一次，拼多多详情接口调用量太大，
   * 新号/出单少的号会触发「大量调取但出单较少」的限流。
   * 价格和佣金一天内基本不会大变，6 小时足够了。
   * 详情页访问时有单条惰性刷新兜底，热门商品数据不会太旧。
   */
  @Cron('0 5 1,7,13,19 * * *')
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

  /**
   * 自动拉品，每天凌晨 02:30。
   *
   * 从各平台拉商品进待选品池（PENDING 状态），运营审核后上架。
   * 放在凌晨跑，避开业务高峰，也别和对账（03:00）挤在一起。
   */
  @Cron('0 30 2 * * *')
  async autoPullGoods() {
    const r = await this.curation.autoPull({});
    this.logger.log(`自动拉品完成: ${JSON.stringify(r)}`);
  }
}
