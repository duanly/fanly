import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum SupportMatchType { EXACT = 1, CONTAINS = 2 }

/** 客服自动回复关键词规则；按 priority 倒序匹配，取第一条命中 */
@Entity('support_auto_reply')
export class SupportAutoReply {
  @PrimaryGeneratedColumn() id: number;

  @Column({ length: 64 }) keyword: string;
  @Column({ type: 'tinyint', default: SupportMatchType.EXACT }) matchType: number;
  @Column({ length: 1000 }) reply: string;
  @Column({ type: 'int', default: 0 }) priority: number;
  @Column({ type: 'boolean', default: true }) enabled: boolean;

  @CreateDateColumn() createdAt: Date;
}
