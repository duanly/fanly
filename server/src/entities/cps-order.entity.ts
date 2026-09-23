import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export enum OrderStatus {
  PAID = 1,      // 已付款
  RECEIVED = 2,  // 已收货
  SETTLED = 3,   // 联盟已结算给平台
  INVALID = 4,   // 已失效（退款/维权）
  CREDITED = 5,  // 平台已把返利发放到用户余额
}

/** 各平台订单归一后的统一模型 */
@Entity('cps_order')
@Unique('uk_platform_order', ['platform', 'platformOrderNo', 'subOrderNo'])
export class CpsOrder {
  @PrimaryGeneratedColumn() id: number;

  @Column({ length: 16 }) platform: string;
  @Column({ length: 64 }) platformOrderNo: string;
  @Column({ length: 64, default: '' }) subOrderNo: string;

  /** 反解子渠道参数得到，可能为空（未归属订单） */
  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  /** 下单时的代理快照，用户以后改绑不影响历史分成 */
  @Index()
  @Column({ type: 'int', nullable: true })
  agentId: number | null;

  @Column({ length: 64, default: '' }) goodsId: string;
  @Column({ length: 255, default: '' }) goodsTitle: string;
  @Column({ length: 255, default: '' }) goodsImg: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) payAmount: string;
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 }) commissionRate: string;
  /** 预估佣金 */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) estCommission: string;
  /** 联盟实际结算给平台的金额 —— 分佣基数 */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) settleCommission: string;

  @Index()
  @Column({ type: 'tinyint', default: OrderStatus.PAID })
  orderStatus: number;

  @Column({ type: 'datetime' }) orderTime: Date;
  @Column({ type: 'datetime', nullable: true }) settleTime: Date | null;

  /** 原始报文留存，对账时唯一依据 */
  @Column({ type: 'simple-json', nullable: true }) rawJson: any;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
