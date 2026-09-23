import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum WithdrawStatus {
  AUDITING = 1, APPROVED = 2, PAYING = 3, SUCCESS = 4, FAILED = 5, REJECTED = 6,
}

@Entity('withdraw')
export class Withdraw {
  @PrimaryGeneratedColumn() id: number;

  @Index() @Column() userId: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 }) amount: string;
  /** 通道实收多少我们收多少 */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) fee: string;

  @Column({ length: 16 }) channel: string;          // WECHAT / ALIPAY
  @Column({ length: 255, default: '' }) accountInfo: string;

  /** 打款幂等号 */
  @Index({ unique: true })
  @Column({ length: 64 })
  outTradeNo: string;

  @Index()
  @Column({ type: 'tinyint', default: WithdrawStatus.AUDITING })
  status: number;

  @Column({ length: 64, default: '' }) channelOrderNo: string;
  @Column({ type: 'int', nullable: true }) auditBy: number | null;
  @Column({ type: 'datetime', nullable: true }) auditTime: Date | null;
  @Column({ length: 255, default: '' }) failReason: string;

  @CreateDateColumn() createdAt: Date;
}
