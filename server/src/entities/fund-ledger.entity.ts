import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum LedgerType {
  REBATE = 'REBATE',            // 用户返利入账
  AGENT_BONUS = 'AGENT_BONUS',  // 代理分成入账
  WITHDRAW = 'WITHDRAW',        // 提现扣减
  WITHDRAW_REFUND = 'WITHDRAW_REFUND', // 提现失败退回
  REVERSE = 'REVERSE',          // 订单失效冲销
  ADJUST = 'ADJUST',            // 人工调帐
}

/**
 * 资金流水：只追加，永不 UPDATE / DELETE。
 * 出事时这张表是唯一认定依据，user.balance 只是它的缓存。
 */
@Entity('fund_ledger')
export class FundLedger {
  @PrimaryGeneratedColumn() id: number;

  @Index() @Column() userId: number;

  @Column({ length: 32 }) bizType: string;
  @Column({ type: 'int', nullable: true }) bizId: number | null;

  /** 正数增、负数减 */
  @Column({ type: 'decimal', precision: 12, scale: 4 }) amount: string;
  /** 变动后余额，供对账重放 */
  @Column({ type: 'decimal', precision: 12, scale: 4 }) balanceAfter: string;

  @Column({ length: 255, default: '' }) remark: string;

  @CreateDateColumn() createdAt: Date;
}
