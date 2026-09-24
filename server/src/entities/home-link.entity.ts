import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * 首页活动位。
 *
 * 「新人 0 元购」「营销日历」这类东西变得很勤，写死在前端每改一次就要重新发版，
 * 所以做成后台可配。url 可以是外链（跳出去），也可以是站内路径（比如 /checkin）。
 */
@Entity('home_link')
export class HomeLink {
  @PrimaryGeneratedColumn() id: number;

  @Column({ length: 32 }) title: string;
  @Column({ length: 32, default: '' }) subtitle: string;
  /** 一个 emoji 就够了，不用传图省事 */
  @Column({ length: 8, default: '' }) icon: string;

  @Column({ length: 512, default: '' }) url: string;
  /** true=站内路由（如 /checkin），false=外链，新窗口打开 */
  @Column({ type: 'boolean', default: false }) internal: boolean;

  @Column({ type: 'int', default: 0 }) sortWeight: number;

  @Index()
  @Column({ type: 'tinyint', default: 1 }) status: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
