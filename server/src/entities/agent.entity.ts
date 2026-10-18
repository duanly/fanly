import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AgentLevel { SILVER = 1, GOLD = 2, DIAMOND = 3 }
export enum AgentStatus { PENDING = 0, ACTIVE = 1, FROZEN = 2 }

@Entity('agent')
export class Agent {
  @PrimaryGeneratedColumn() id: number;

  /** 代理本人的 user.id */
  @Index({ unique: true })
  @Column()
  userId: number;

  /** 专属推广码，二维码内容 = H5_BASE_URL/i/{agentCode} */
  @Index({ unique: true })
  @Column({ length: 8 })
  agentCode: string;

  /** 预留字段：一级模式下不参与分佣，以后要做二级不用改表 */
  @Column({ type: 'int', nullable: true }) parentAgentId: number | null;

  @Column({ type: 'tinyint', default: AgentLevel.SILVER }) level: number;

  /** 手动设置的等级，优先级高于自动升级（自动升级不覆盖） */
  @Column({ type: 'boolean', default: false }) manualLevel: boolean;

  /** 自定义分成比例；为空则取等级模板 */
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true }) agentRate: string | null;

  @Column({ type: 'tinyint', default: AgentStatus.PENDING }) status: number;

  @Column({ length: 64, default: '' }) realName: string;
  @Column({ length: 255, default: '' }) remark: string;

  @CreateDateColumn() createdAt: Date;
}
