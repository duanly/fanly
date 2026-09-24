import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';

export enum CuratedStatus {
  OFF = 0,      // 人工下架
  ON = 1,       // 上架
  EXPIRED = 2,  // 自动下架：佣金归零或商品已退出推广
}

/**
 * 选品池：后台人工挑出来的商品。
 *
 * 首页和专题读这张表，不实时打平台接口。三个理由：
 *   1. 平台接口有 QPS 限制，每次打开首页都调一次迟早被限流
 *   2. 商品随时可能下架或佣金归零，用户点进去发现没返利最伤信任
 *   3. 首页放什么得由运营说了算，不能交给平台的推荐算法
 *
 * 价格和佣金是**快照**，由定时任务每小时刷一次，失效的自动下架。
 */
@Entity('curated_goods')
@Unique('uk_curated_goods', ['platform', 'goodsId'])
export class CuratedGoods {
  @PrimaryGeneratedColumn() id: number;

  @Column({ length: 16 }) platform: string;

  /** 拼多多这里存的是 goods_sign，不是 goods_id —— 转链和详情只认前者 */
  @Column({ length: 128 }) goodsId: string;

  @Column({ length: 255, default: '' }) title: string;
  @Column({ length: 512, default: '' }) image: string;
  @Column({ length: 128, default: '' }) shopName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) price: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) couponPrice: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) couponAmount: string;
  @Column({ type: 'decimal', precision: 6, scale: 4, default: 0 }) commissionRate: string;
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) commission: string;
  @Column({ type: 'int', default: 0 }) salesVolume: number;

  /** 专题分组：default 是首页，其余自定义，比如 9块9 / 大额券 / 日用百货 */
  @Index()
  @Column({ length: 32, default: 'default' }) groupKey: string;

  /** 越大越靠前；同权重之间按佣金金额降序 */
  @Column({ type: 'int', default: 0 }) sortWeight: number;

  @Index()
  @Column({ type: 'tinyint', default: CuratedStatus.ON }) status: number;

  /** 自动下架时记下原因，后台一眼能看出为什么没了 */
  @Column({ length: 128, default: '' }) offReason: string;

  @Column({ type: 'datetime', nullable: true }) lastSyncAt: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
