import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * 专题 = 标签 = 页面 = 首页入口，四个东西是同一个。
 *
 * 之前这三件事是散开的：商品靠 curated_goods.groupKey 归类（还只能归一个），
 * 首页入口靠 home_link 手填 URL，专题页没有。结果建一个「婴儿用品」要做三步，
 * 还得自己猜 URL 填什么。
 *
 * 现在建一条 topic 就齐了：
 *   · 它是标签  —— 商品通过 goods_topic 挂上来，一个商品可以挂多个
 *   · 它是页面  —— H5 有个通用路由 /topic/:slug，内容由这条记录 + 挂上来的商品决定
 *   · 它是入口  —— slot 决定它在首页哪儿露面，不用再去 home_link 配一遍
 *
 * 为什么不生成真的页面文件：文件得进构建，每建一个专题就要重新打包部署一次，
 * 运营点一下按钮的事不该牵动发版。通用页 + 自动 slug 效果一样，代价为零。
 */
@Entity('topic')
export class Topic {
  @PrimaryGeneratedColumn() id: number;

  /**
   * URL 里那一段，页面地址就是 /topic/{slug}。
   * 只允许小写字母数字和连字符：中文进 URL 会被转义成一长串百分号，
   * 运营复制粘贴时很容易弄断。名字用 name 显示，slug 只管寻址。
   *
   * 建好之后别改——改了等于换页面地址，之前分享出去的链接全失效。
   */
  @Index({ unique: true })
  @Column({ length: 48 }) slug: string;

  @Column({ length: 32 }) name: string;

  /** 一个 emoji 就够，宫格里显示 */
  @Column({ length: 8, default: '' }) icon: string;

  /** 宫格图标底色：CSS 渐变串或纯色 */
  @Column({ length: 128, default: '' }) bg: string;

  /** 专题页头图，留空就用 bg 的渐变 */
  @Column({ length: 512, default: '' }) cover: string;

  /** 专题页顶部那句说明，也用作活动位卡片的副标题 */
  @Column({ length: 64, default: '' }) intro: string;

  /**
   * 在首页哪儿露面：
   *   grid      八大分区宫格
   *   activity  活动位（宫格上方那排卡片）
   *   hidden    只当标签用，首页不出现
   *
   * hidden 是必要的：像「9块9特卖」这种你可能只想在筛选和搜索里用，
   * 不想占掉宫格那八个格子——格子是最贵的位置。
   */
  @Index()
  @Column({ length: 16, default: 'grid' }) slot: string;

  /** 越大越靠前 */
  @Column({ type: 'int', default: 0 }) sortWeight: number;

  @Index()
  @Column({ type: 'tinyint', default: 1 }) status: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

export const TOPIC_SLOTS = ['grid', 'activity', 'hidden'] as const;
