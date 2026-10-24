import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';

interface CaptchaEntry {
  code: string;
  expireAt: number;
}

/**
 * 图形验证码服务。
 * 验证码存在内存 Map 中，5 分钟过期，一次性使用。
 */
@Injectable()
export class CaptchaService {
  private readonly store = new Map<string, CaptchaEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 分钟

  /** 生成图形验证码，返回 key 和 svg 字符串 */
  generate(): { key: string; svg: string } {
    const cap = svgCaptcha.create({
      size: 4,           // 4 个字符
      noise: 3,          // 干扰线数量
      color: true,       // 字符颜色随机
      background: '#f5f7fa',
      width: 110,
      height: 40,
      fontSize: 32,
      ignoreChars: '0o1ilI', // 去掉容易混淆的字符
    });
    const key = this.genKey();
    this.store.set(key, {
      code: cap.text.toLowerCase(),
      expireAt: Date.now() + this.TTL,
    });
    // 清理一下过期的，避免内存泄露（简单扫一遍就行，量不大）
    this.cleanup();
    return { key, svg: cap.data };
  }

  /** 验证图形验证码，验证通过后删除（一次性使用） */
  verify(key: string, code: string): boolean {
    if (!key || !code) return false;
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expireAt) {
      this.store.delete(key);
      return false;
    }
    this.store.delete(key); // 一次性使用
    return entry.code === code.toLowerCase().trim();
  }

  private genKey(): string {
    // 简单的随机 key：时间戳 + 随机串
    return `cap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private cleanup() {
    // 每生成 50 个清理一次过期项
    if (this.store.size < 50) return;
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now > v.expireAt) this.store.delete(k);
    }
  }
}
