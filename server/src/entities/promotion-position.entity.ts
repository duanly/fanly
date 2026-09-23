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
}
