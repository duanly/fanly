import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';

/**
 * 我们自己的购物车。
 *
 * 跟电商的购物车不是一回事：这里存的只是「看中了、回头再买」的清单，
 * 真正下单仍然发生在各平台的 App 里。所以没有数量、没有 SKU，
 * 一件商品就是一行，去买的时候按平台分别转链跳出去。
 *
 * 价格是加入时的快照，打开购物车会去刷新——
 * 用户攒了两周的车，价格早变了，拿旧价格给他看比不给还糟。
 */
@Entity('cart_item')
@Unique('uk_cart_user_goods', ['userId', 'platform', 'goodsId'])
export class CartItem {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column() userId: number;

  @Column({ length: 16 }) platform: string;
  @Column({ length: 128 }) goodsId: string;

  @Column({ length: 255, default: '' }) title: string;
  @Column({ length: 512, default: '' }) image: string;

  /** 加入时的价格，用来跟当前价对比，告诉用户「降了 3 块」 */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) addedPrice: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) couponPrice: string;
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) commission: string;

  @Column({ type: 'datetime', nullable: true }) syncedAt: Date | null;
  /** 刷新时发现商品没了或没佣金了，标记出来别让用户白跳一趟 */
  @Column({ length: 64, default: '' }) invalidReason: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
