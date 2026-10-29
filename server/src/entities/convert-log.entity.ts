import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 转链记录（归因兜底依据）。
 *
 * 用户每次成功转链/解析商品时记一条：谁、哪个平台、哪个商品、用的哪个推广位。
 * 当平台回传订单丢失了自定义跟单标识（取消重下、换规格等），
 * 按 platform + goodsId 找到最近转链的用户，把无主订单兜底归属给他。
 *
 * 只做追加，不更新；靠 (platform, goodsId, createdAt) 索引做回溯查询。
 */
@Entity('convert_log')
@Index('idx_convert_match', ['platform', 'goodsId', 'createdAt'])
export class ConvertLog {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column()
  userId: number;

  @Column({ length: 16 })
  platform: string;

  /** 平台商品标识：PDD goods_sign / TB item_id / JTK act_id 等 */
  @Column({ length: 64 })
  goodsId: string;

  /** 转链时使用的推广位（=订单正常时回传的 positionId），可空 */
  @Column({ length: 96, default: '' })
  positionId: string;

  /** 来源：convert 手动转链 / parse 口令解析 / jutuike 本地生活 */
  @Column({ length: 16, default: 'convert' })
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}
