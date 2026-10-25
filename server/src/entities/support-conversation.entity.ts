import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 客服会话：每个用户至多一条，首次进入客服页时 find-or-create。
 * 列表按 lastMessageAt 倒序。
 */
@Entity('support_conversation')
export class SupportConversation {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column()
  userId: number;

  /** 客服侧未读数 */
  @Column({ type: 'int', default: 0 }) staffUnread: number;
  /** 用户侧未读数 */
  @Column({ type: 'int', default: 0 }) userUnread: number;

  /** 最后消息预览（图片消息存「[图片]」） */
  @Column({ length: 255, default: '' }) lastMessage: string;
  @Column({ type: 'tinyint', default: 1 }) lastMessageType: number;
  @Column({ type: 'datetime', nullable: true }) lastMessageAt: Date | null;

  @CreateDateColumn() createdAt: Date;
}
