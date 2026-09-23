import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 平台用户。代理本人同时也是一条 user 记录。 */
@Entity('user')
export class User {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column({ length: 20 })
  mobile: string;

  @Column({ length: 64, default: '' }) nickname: string;
  @Column({ length: 255, default: '' }) avatar: string;

  /** 自己的邀请码（每个用户都有，用户也能拉人，只是没有代理身份不分成） */
  @Index({ unique: true })
  @Column({ length: 8 })
  inviteCode: string;

  /** 所属代理，绑定后不可变更 */
  @Index()
  @Column({ type: 'int', nullable: true })
  agentId: number | null;

  @Column({ type: 'datetime', nullable: true }) bindTime: Date | null;

  /** 可提现余额 */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) balance: string;
  /** 提现冻结中 */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) frozen: string;
  /** 预估返利（订单未结算，不可提） */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) pending: string;
  /** 累计已返 */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) totalRebate: string;

  /** 风控用设备指纹 */
  @Column({ length: 64, default: '' }) deviceId: string;

  /** 淘宝渠道备案 */
  @Column({ length: 64, default: '' }) tbRelationId: string;
  @Column({ length: 64, default: '' }) tbSpecialId: string;

  /** 1 正常 2 冻结 */
  @Column({ type: 'tinyint', default: 1 }) status: number;

  @CreateDateColumn() createdAt: Date;
}
