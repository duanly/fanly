import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysConfig } from '@/entities';

/** 后台可调参数，默认值在这里，改后台即时生效 */
export const DEFAULT_CONFIG: Record<string, { value: string; remark: string }> = {
  'rebate.user_rate':        { value: '0.50', remark: '用户返利比例（占联盟实结佣金）' },
  'rebate.agent_rate.1':     { value: '0.10', remark: '普通代理分成比例' },
  'rebate.agent_rate.2':     { value: '0.15', remark: '高级代理分成比例' },
  'rebate.agent_rate.3':     { value: '0.20', remark: '合伙人分成比例' },
  // 二级分成：上级的上级也分一笔。比例明显低于一级，
  // 三方加起来别超过 1，否则平台那份会变负数
  'rebate.agent_rate_l2':    { value: '0.05', remark: '二级代理分成比例（上级的上级）' },
  'agent.level_up.2':        { value: '100',  remark: '升高级代理所需月有效订单数' },
  'agent.level_up.3':        { value: '500',  remark: '升合伙人所需月有效订单数' },
  'agent.need_pay':          { value: '0',    remark: '代理是否需付费加盟 1是 0否' },
  'withdraw.min':            { value: '10',   remark: '最低提现金额（元）' },
  'withdraw.max':            { value: '800',  remark: '单笔提现上限（元）' },
  'withdraw.fee_rate':       { value: '0',    remark: '提现手续费率，按金融通道实收设置' },
  'withdraw.fee_fixed':      { value: '0',    remark: '提现固定手续费（元），通道收多少填多少' },
  'withdraw.daily_limit':    { value: '1',    remark: '每日提现次数上限' },
  // 金币：平台自贴的营销成本，跟联盟返利分开记账
  'coin.checkin_base':       { value: '10',   remark: '签到基础金币' },
  'coin.checkin_streak_bonus': { value: '5',  remark: '连续签到每多一天加多少金币' },
  'coin.checkin_max':        { value: '50',   remark: '单日签到金币上限' },
  'coin.exchange_rate':      { value: '100',  remark: '多少金币兑 1 元' },
  'coin.exchange_min':       { value: '1000', remark: '最低兑换金币数' },
  'risk.device_max_account': { value: '3',    remark: '同设备最多绑定账号数' },
  'risk.new_user_days':      { value: '7',    remark: '新用户天数，内大额提现需人工审核' },
  'risk.new_user_amount':    { value: '500',  remark: '新用户大额提现阈值（元）' },
};

@Injectable()
export class SysConfigService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(@InjectRepository(SysConfig) private readonly repo: Repository<SysConfig>) {}

  async onModuleInit() {
    for (const [key, v] of Object.entries(DEFAULT_CONFIG)) {
      const exist = await this.repo.findOneBy({ key });
      if (!exist) await this.repo.save(this.repo.create({ key, value: v.value, remark: v.remark }));
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
