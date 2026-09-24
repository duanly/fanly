import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum CoinType {
  CHECKIN = 'CHECKIN',     // 签到获得
  EXCHANGE = 'EXCHANGE',   // 兑换成余额（负数）
  ADJUST = 'ADJUST',       // 人工调整
}

/**
 * 金币流水。
 *
 * 金币是**独立于资金的一套账**，故意不进 fund_ledger——
 * 签到送的是平台自己贴的营销成本，跟联盟返利的钱混在一起会让对账失真。
 * 只有兑换那一刻才跨过去，写一条 fund_ledger。
 */
@Entity('coin_ledger')
export class CoinLedger {
  @PrimaryGeneratedColumn() id: number;

  @Index() @Column() userId: number;

  @Column({ length: 16 }) bizType: string;
  /** 正数增、负数减 */
  @Column({ type: 'int' }) amount: number;
  @Column({ type: 'int' }) balanceAfter: number;

  @Column({ length: 255, default: '' }) remark: string;

  @CreateDateColumn() createdAt: Date;
}
