import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * 推广位：每个用户 × 每个平台一条。
 * positionId 会被塞进各平台的子渠道参数里，拉订单时反解出 userId。
 */
@Entity('promotion_position')
@Unique('uk_user_platform', ['userId', 'platform'])
export class PromotionPosition {
  @PrimaryGeneratedColumn() id: number;
  @Column() userId: number;

  /** TB / JD / PDD / DY */
  @Column({ length: 16 }) platform: string;

  @Index()
  @Column({ length: 64 })
  positionId: string;

  /**
   * 平台授权（拼多多叫备案）是否完成。
   * 拼多多按 pid + custom_parameters 的组合记备案，每个用户一组，
   * 所以要逐人授权。查过一次就缓存在这儿，别在转链路径上多一次网络往返。
   */
  @Column({ type: 'boolean', default: false }) bound: boolean;

  @Column({ type: 'datetime', nullable: true }) boundAt: Date | null;
}
