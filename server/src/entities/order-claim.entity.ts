import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';

export enum ClaimStatus {
  PENDING = 1,   // 待处理（订单可能还没拉回来，定时任务会重试）
  APPROVED = 2,  // 已归属到该用户
  REJECTED = 3,  // 驳回
}

/**
 * 订单找回。
 *
 * 用户下了单但我们没认到——链接没走我们的、归属参数丢了、或者订单还没同步回来。
 * 没有这个入口的话，这类问题会变成客服量最大的来源，而且用户会直接流失：
 * 他试了一次没返利，就不会有第二次。
 *
 * 处理原则：**只找回「订单确实存在、只是没认到人」的**。
 * 压根没走我们链接的订单，联盟那边就没有佣金，补了也是平台自己贴钱。
 */
@Entity('order_claim')
@Unique('uk_claim_order', ['platform', 'platformOrderNo'])
export class OrderClaim {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column() userId: number;

  @Column({ length: 16 }) platform: string;
  @Column({ length: 64 }) platformOrderNo: string;

  /** 用户填的，仅供后台核对，不参与匹配 */
  @Column({ length: 255, default: '' }) goodsTitle: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) payAmount: string;
  @Column({ type: 'datetime', nullable: true }) orderDate: Date | null;
  @Column({ length: 255, default: '' }) remark: string;

  @Index()
  @Column({ type: 'tinyint', default: ClaimStatus.PENDING }) status: number;

  /** 匹配上的订单，审核通过后回填 */
  @Column({ type: 'int', nullable: true }) matchedOrderId: number | null;

  @Column({ length: 255, default: '' }) resultReason: string;

  @Column({ type: 'int', nullable: true }) auditBy: number | null;
  @Column({ type: 'datetime', nullable: true }) auditTime: Date | null;

  /** 自动重试了几次，太多次还没匹配上就别再试了 */
  @Column({ type: 'int', default: 0 }) retryCount: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
