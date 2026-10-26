import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum LevelRequestType { UPGRADE = 1, DOWNGRADE = 2 }
export enum LevelRequestStatus { PENDING = 0, APPROVED = 1, REJECTED = 2, CANCELED = 3 }

/**
 * 代理等级升降审核记录。
 *
 * 每日扫描业绩，达到阈值生成一条待办，人工核准后等级才变更——
 * 既防异常刷单直接冲级，也让每次升降级可追溯。低频事件，独立留痕。
 */
@Entity('agent_level_request')
export class AgentLevelRequest {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column()
  agentId: number;
  @Column() userId: number;

  /** 1升级 / 2降级 */
  @Column({ type: 'tinyint' }) requestType: number;
  @Column({ type: 'tinyint' }) fromLevel: number;
  @Column({ type: 'tinyint' }) toLevel: number;

  /** 触发时近 90 天已结算佣金快照（留证） */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) perfSnapshot: string;

  /** 降级宽限截止时间（仅降级有；到期未处理且业绩未恢复则自动降级） */
  @Column({ type: 'datetime', nullable: true }) graceUntil: Date | null;

  /** 0待审 / 1通过 / 2驳回 / 3取消（业绩恢复自动关闭） */
  @Index()
  @Column({ type: 'tinyint', default: LevelRequestStatus.PENDING })
  status: number;

  @Column({ length: 255, default: '' }) rejectReason: string;
  @Column({ type: 'int', nullable: true }) auditAdminId: number | null;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'datetime', nullable: true }) auditedAt: Date | null;
}
