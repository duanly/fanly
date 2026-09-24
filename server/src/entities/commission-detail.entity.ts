import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum Beneficiary {
  USER = 1,
  AGENT = 2,      // 直属上级（一级）
  PLATFORM = 3,
  AGENT_L2 = 4,   // 上级的上级（二级）
}
export enum CommissionStatus { PENDING = 1, CREDITED = 2, REVERSED = 3 }

/** 一笔订单拆成用户返利 / 代理分成 / 平台利润三条明细 */
@Entity('commission_detail')
@Unique('uk_order_bene', ['orderId', 'beneficiaryType', 'beneficiaryId'])
export class CommissionDetail {
  @PrimaryGeneratedColumn() id: number;

  @Index() @Column() orderId: number;

  @Column({ type: 'tinyint' }) beneficiaryType: number;
  @Column({ type: 'int', nullable: true }) beneficiaryId: number | null;

  /** 分佣基数 = 联盟实结佣金 */
  @Column({ type: 'decimal', precision: 12, scale: 4 }) baseAmount: string;
  @Column({ type: 'decimal', precision: 5, scale: 4 }) rate: string;
  @Column({ type: 'decimal', precision: 12, scale: 4 }) amount: string;

  @Index()
  @Column({ type: 'tinyint', default: CommissionStatus.PENDING })
  status: number;

  @CreateDateColumn() createdAt: Date;
}
