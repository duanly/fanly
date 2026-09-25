import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique,
} from 'typeorm';

/**
 * 商品 ↔ 专题 的关联，多对多。
 *
 * 用独立表而不是 TypeORM 的 @ManyToMany：
 * 关联表上要挂自己的字段（这条关联的排序权重），而且后台经常
 * 「某专题下的商品按权重排」这样查，自己建表查起来直白得多。
 *
 * 存 curatedId 而不是 platform+goodsId：商品在选品池里只有一条记录，
 * 拿自增主键关联省一半索引空间，删商品时也好级联清理。
 */
@Entity('goods_topic')
@Unique('uk_goods_topic', ['curatedId', 'topicId'])
export class GoodsTopic {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ type: 'int' }) curatedId: number;

  @Index()
  @Column({ type: 'int' }) topicId: number;

  /**
   * 这个商品在这个专题里的排序权重。
   * 独立于 curated_goods.sortWeight——同一件商品可以在「婴儿用品」里置顶，
   * 在「日用百货」里排在后面，这正是多对多的意义。
   */
  @Column({ type: 'int', default: 0 }) sortWeight: number;

  @CreateDateColumn() createdAt: Date;
}
