import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 客服会话。
 * - 登录用户：每人至多一条（userId 唯一），首次进入客服页时 find-or-create。
 * - 未登录访客（忘记密码入口）：userId 为空，靠服务端下发的随机 guestKey 认人。
 * 列表按 lastMessageAt 倒序。
 */
@Entity('support_conversation')
export class SupportConversation {
  @PrimaryGeneratedColumn() id: number;

  /** 访客会话为 NULL（唯一索引允许多个 NULL） */
  @Index({ unique: true })
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  /** 访客会话凭证：服务端生成的随机串，存在访客本机；登录用户会话为 NULL */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  guestKey: string | null;
  /** 访客自报的注册手机号——未经验证，客服重置密码前必须另行核实身份 */
  @Column({ length: 20, default: '' }) guestMobile: string;

  /** 客服侧未读数 */
  @Column({ type: 'int', default: 0 }) staffUnread: number;
  /** 用户侧未读数 */
  @Column({ type: 'int', default: 0 }) userUnread: number;

  /** 最后消息预览（图片消息存「[图片]」） */
  @Column({ length: 255, default: '' }) lastMessage: string;
  @Column({ type: 'tinyint', default: 1 }) lastMessageType: number;
  @Column({ type: 'datetime', nullable: true }) lastMessageAt: Date | null;

  /** 最早一条「还没人回」的用户消息时间；有人工/自动回复后清空。超时默认回复靠它扫描 */
  @Index()
  @Column({ type: 'datetime', nullable: true }) pendingSince: Date | null;
  /** 默认回复是否已发过；人工回复后复位，避免客服不在时同一句话反复刷屏 */
  @Column({ type: 'boolean', default: false }) defaultReplied: boolean;

  @CreateDateColumn() createdAt: Date;
}
