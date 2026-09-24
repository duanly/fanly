import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * 比价组：同一件标品在各平台的集合。
 *
 * 为什么只做标品：各平台之间没有共享的商品标识（goods_sign / skuId / item_id
 * 互不相通，也拿不到条码），只能靠品牌+型号+规格推断。
 * 奶粉、数码、文具这类标品推得准；白牌非标品每家都是独立链接，压根没有「同款」。
 *
 * 宁可少，不能错——比价报错一次，用户就再也不信这个页面了。
 * 所以成员由人工从选品池挑进来，不做自动匹配。
 */
@Entity('compare_group')
export class CompareGroup {
  @PrimaryGeneratedColumn() id: number;

  /** 展示名，写清型号，例如「飞鹤星飞帆 1段 700g」 */
  @Column({ length: 128 }) name: string;

  /**
   * 规格说明，例如「单罐，不含赠品」。
   * 套装和赠品是比价失真的头号原因，必须写出来让用户自己判断。
   */
  @Column({ length: 128, default: '' }) spec: string;

  /** 归到哪个专题，跟 curated_goods.groupKey 用同一套 key */
  @Index()
  @Column({ length: 32, default: 'default' }) groupKey: string;

  @Column({ length: 512, default: '' }) cover: string;

  @Index()
  @Column({ type: 'tinyint', default: 1 }) status: number;   // 1 上架 0 下架

  @Column({ type: 'int', default: 0 }) sortWeight: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
