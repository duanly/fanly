/**
 * 进程内 TTL 缓存，带并发去重。
 *
 * 为什么不上 Redis：单实例部署，进程内就够了，少一个依赖少一处故障点。
 * 真要多实例了，把 wrap 换成 Redis 实现即可，调用方一行不用改。
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expireAt: number }>();
  /** 同一个 key 正在跑的请求，防止缓存刚过期时一窝蜂打后端 */
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number, private readonly max = 200) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expireAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.max && !this.store.has(key)) {
      // Map 保持插入序，删最早那个就行，不值得为这点量上 LRU
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expireAt: Date.now() + this.ttlMs });
  }

  async wrap(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const running = this.inflight.get(key);
    if (running) return running;

    const task = loader()
      .then((v) => {
        this.set(key, v);
        return v;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, task);
    return task;
  }

  /** 后台改了选品或分成比例后调一下，让下一次请求拿新数据 */
  clear(): void {
    this.store.clear();
  }
}
