import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum SupportSender { USER = 1, STAFF = 2, AUTO = 3 }
export enum SupportMsgType { TEXT = 1, IMAGE = 2 }

@Entity('support_message')
export class SupportMessage {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column()
  conversationId: number;

  @Column({ type: 'tinyint' }) senderType: number;
  /** 客服消息的发送人 admin_user.id；自动/用户消息为空 */
  @Column({ type: 'int', nullable: true }) senderAdminId: number | null;

  @Column({ type: 'tinyint', default: SupportMsgType.TEXT }) type: number;
  /** 文本 ≤1000 字；图片消息为 /uploads/... URL */
  @Column({ length: 1000 }) content: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
