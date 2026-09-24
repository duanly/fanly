import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * 签到记录。
 *
 * 一人一天一条，靠唯一键防重复——比在代码里判断可靠得多，
 * 并发点两下也只会成一条。
 */
@Entity('checkin')
@Unique('uk_checkin_user_day', ['userId', 'day'])
export class Checkin {
  @PrimaryGeneratedColumn() id: number;

  @Index() @Column() userId: number;

  /** 'YYYY-MM-DD'，用字符串省去时区的麻烦 */
  @Column({ length: 10 }) day: string;

  /** 这是连续签到的第几天 */
  @Column({ type: 'int', default: 1 }) streak: number;

  @Column({ type: 'int', default: 0 }) coins: number;

  @CreateDateColumn() createdAt: Date;
}
