import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * 用户对商品的推荐（点赞）。
 *
 * 一人一件商品一条，次数累加，上限由后台参数控制——
 * 不限次数的话一个人就能把任意商品刷上榜，推荐榜立刻失去意义。
 */
@Entity('goods_recommend')
@Unique('uk_rec_user_goods', ['userId', 'platform', 'goodsId'])
export class GoodsRecommend {
  @PrimaryGeneratedColumn() id: number;

  @Index() @Column() userId: number;

  @Column({ length: 16 }) platform: string;
  @Column({ length: 128 }) goodsId: string;

  /** 这个用户推了几次 */
  @Column({ type: 'int', default: 1 }) times: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
