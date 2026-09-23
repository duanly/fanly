import { Injectable, Logger } from '@nestjs/common';
import {
  ConvertedLink, CpsProvider, SearchParams, UnifiedGoods, UnifiedOrder,
} from '../cps.types';

const CATEGORIES = [
  ['9.9 包邮', ['纯棉短袖T恤', '一次性洗脸巾', '不锈钢保温杯', '收纳袋十只装']],
  ['今日爆款', ['蓝牙耳机无线降噪', '空气炸锅家用', '电动牙刷软毛', '筋膜枪迷你']],
  ['大额券', ['运动跑鞋男款', '羽绒服轻薄款', '扫地机器人', '智能手表血氧']],
  ['日用百货', ['抽纸整箱', '洗衣凝珠', '垃圾袋加厚', '洗洁精柠檬']],
];

/**
 * 本地假数据渠道：不需要任何 API Key 就能把选品 → 转链 → 订单 → 分佣全链路跑通。
 * 正式对接后把 CPS_PROVIDER 改成 aggregator / pdd / jd 即可，业务代码一行不动。
 */
@Injectable()
export class MockProvider implements CpsProvider {
  readonly platform: string;
  private readonly logger = new Logger(MockProvider.name);
  /** 内存里记录转过链的订单种子，模拟"用户真的去下单了" */
  private readonly pendingOrders: UnifiedOrder[] = [];

  constructor(platform = 'MOCK') {
    this.platform = platform;
  }

  private buildGoods(seed: number): UnifiedGoods {
    const [cat, names] = CATEGORIES[seed % CATEGORIES.length];
    const title = `${names[seed % names.length]}【${cat}】`;
    const price = Math.round((9.9 + (seed % 40) * 7.3) * 100) / 100;
    const couponAmount = Math.round(price * 0.2 * 100) / 100;
    const couponPrice = Math.round((price - couponAmount) * 100) / 100;
    const commissionRate = Math.round((0.05 + (seed % 20) / 100) * 10000) / 10000;
    return {
      platform: this.platform,
      goodsId: `MK${String(seed).padStart(8, '0')}`,
      title,
      image: `https://picsum.photos/seed/${seed}/400/400`,
      shopName: `旗舰店${(seed % 30) + 1}号`,
      price,
      couponPrice,
      couponAmount,
      commissionRate,
      commission: Math.round(couponPrice * commissionRate * 100) / 100,
      salesVolume: (seed * 137) % 9000,
    };
  }

  async searchGoods(params: SearchParams): Promise<UnifiedGoods[]> {
    const page = params.page || 1;
    const size = params.pageSize || 20;
    const list = Array.from({ length: size }, (_, i) => this.buildGoods((page - 1) * size + i + 1));
    if (params.keyword) list.forEach((g) => (g.title = `${params.keyword} ${g.title}`));
    if (params.sort === 'commission') list.sort((a, b) => b.commission - a.commission);
    if (params.sort === 'price') list.sort((a, b) => a.couponPrice - b.couponPrice);
    if (params.sort === 'sales') list.sort((a, b) => b.salesVolume - a.salesVolume);
    return list;
  }

  async getGoodsDetail(goodsId: string): Promise<UnifiedGoods | null> {
    const n = parseInt(goodsId.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? null : this.buildGoods(n);
  }

  async convertLink(goodsId: string, positionId: string): Promise<ConvertedLink> {
    return {
      platform: this.platform,
      goodsId,
      shortUrl: `https://mock.cps.local/s/${goodsId}?pid=${positionId}`,
      deeplink: `mockapp://goods?id=${goodsId}&pid=${positionId}`,
      password: `¥Mk${goodsId.slice(-6)}${positionId.slice(-4)}¥`,
      positionId,
    };
  }

  async parseContent(text: string): Promise<UnifiedGoods | null> {
    const m = text.match(/MK\d{8}/) || text.match(/\d{4,}/);
    if (!m) return this.buildGoods(Math.floor(Math.random() * 100) + 1);
    return this.getGoodsDetail(m[0].startsWith('MK') ? m[0] : `MK${m[0].padStart(8, '0')}`);
  }

  /** 供测试脚本调用：模拟用户下了一单 */
  seedOrder(order: UnifiedOrder) {
    this.pendingOrders.push(order);
  }

  async fetchOrders(start: Date, end: Date): Promise<UnifiedOrder[]> {
    const hit = this.pendingOrders.filter(
      (o) => o.orderTime >= start && o.orderTime <= end,
    );
    this.logger.debug(`mock fetchOrders ${start.toISOString()} ~ ${end.toISOString()} → ${hit.length}`);
    return hit;
  }
}
