import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysConfig } from '@/entities';

/** 后台可调参数，默认值在这里，改后台即时生效 */
export const DEFAULT_CONFIG: Record<string, { value: string; remark: string }> = {
  'rebate.user_rate':        { value: '0.50', remark: '用户返利比例（占联盟实结佣金）' },
  'rebate.agent_rate.1':     { value: '0.12', remark: '白银代理分成比例' },
  'rebate.agent_rate.2':     { value: '0.15', remark: '黄金代理分成比例' },
  'rebate.agent_rate.3':     { value: '0.20', remark: '钻石代理分成比例' },
  // 业绩考核：等级与分成只挂钩真实成交业绩、不挂人头（合规要求）
  'agent.perf.period_days':  { value: '90',   remark: '代理等级滚动考核周期（天）' },
  'agent.perf.gold':         { value: '1000', remark: '黄金门槛：周期内团队已结算佣金（元）' },
  'agent.perf.diamond':      { value: '5000', remark: '钻石门槛：周期内团队已结算佣金（元）' },
  // 二级团队分成档：按周期内二级团队已结算佣金（不再按人数）
  'agent.l2.perf_t1':        { value: '500',  remark: '二级分成 2% 门槛：二级团队已结算佣金（元）' },
  'agent.l2.perf_t2':        { value: '2000', remark: '二级分成 3% 门槛（元）' },
  'agent.l2.perf_t3':        { value: '8000', remark: '二级分成 4% 门槛（元）' },
  'agent.downgrade.grace_days': { value: '15', remark: '降级宽限天数（期间人工确认或冲刺业绩保留等级）' },
  'agent.audit.reject_cooldown': { value: '30', remark: '同一升级被驳回后冷却天数' },
  'agent.need_pay':          { value: '0',    remark: '代理是否需付费加盟 1是 0否' },
  'goods.convert_sort_weight': { value: '900', remark: '转链抓取商品的高推荐权重（越大越靠前）' },
  'withdraw.min':            { value: '10',   remark: '最低提现金额（元）' },
  'withdraw.max':            { value: '800',  remark: '单笔提现上限（元）' },
  'withdraw.fee_rate':       { value: '0',    remark: '提现手续费率，按金融通道实收设置' },
  'withdraw.fee_fixed':      { value: '0',    remark: '提现固定手续费（元），通道收多少填多少' },
  'withdraw.daily_limit':    { value: '1',    remark: '每日提现次数上限' },
  // 金币：平台自贴的营销成本，跟联盟返利分开记账
  'goods.recommend_limit':   { value: '5',    remark: '每人对同一商品最多推荐几次' },
  'coin.checkin_base':       { value: '10',   remark: '签到基础金币' },
  'coin.checkin_streak_bonus': { value: '5',  remark: '连续签到每多一天加多少金币' },
  'coin.checkin_max':        { value: '50',   remark: '单日签到金币上限' },
  'coin.exchange_rate':      { value: '100',  remark: '多少金币兑 1 元' },
  'coin.exchange_min':       { value: '1000', remark: '最低兑换金币数' },
  'coin.invite_reward':      { value: '100',  remark: '邀请好友注册奖励金币数' },
  'risk.device_max_account': { value: '3',    remark: '同设备最多绑定账号数' },
  'risk.new_user_days':      { value: '7',    remark: '新用户天数，内大额提现需人工审核' },
  'risk.new_user_amount':    { value: '500',  remark: '新用户大额提现阈值（元）' },
  // 在线客服
  'support.welcome':         { value: '您好，欢迎联系客服，请问有什么可以帮您？工作时间内我们会尽快回复～', remark: '客服欢迎语（首次进入会话时发送）' },
  'support.fallback':        { value: '',     remark: '自动回复未命中时的兜底语；留空则不回复' },
  'support.auto_reply':      { value: '1',    remark: '自动回复开关 1开 0关' },
};

@Injectable()
export class SysConfigService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(@InjectRepository(SysConfig) private readonly repo: Repository<SysConfig>) {}

  async onModuleInit() {
    for (const [key, v] of Object.entries(DEFAULT_CONFIG)) {
      const exist = await this.repo.findOneBy({ key });
      if (!exist) {
        await this.repo.save(this.repo.create({ key, value: v.value, remark: v.remark }));
      } else if (exist.remark !== v.remark) {
        // 代码里更新了说明文字，同步到数据库（只改 remark，不动 value——用户可能手动调过值）
        exist.remark = v.remark;
        await this.repo.save(exist);
      }
    }
    await this.reload();
  }

  async reload() {
    const rows = await this.repo.find();
    this.cache = new Map(rows.map((r) => [r.key, r.value]));
  }

  get(key: string, fallback = ''): string {
    return this.cache.get(key) ?? DEFAULT_CONFIG[key]?.value ?? fallback;
  }

  num(key: string, fallback = 0): number {
    const v = parseFloat(this.get(key));
    return Number.isNaN(v) ? fallback : v;
  }

  async set(key: string, value: string) {
    await this.repo.save({ key, value });
    await this.reload();
  }

  async list() {
    return this.repo.find({ order: { key: 'ASC' } });
  }
}
