import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ConvertLog } from '@/entities';

/**
 * 转链记录：写入 + 无主订单兜底查找。
 *
 * 订单正常靠平台回传的 positionId 归属；当标识丢失（取消重下、换规格），
 * 用「平台 + 商品」找最近转过链的用户兜底。匹配窗口默认 7 天。
 */
@Injectable()
export class ConvertLogService {
  private readonly logger = Logger(ConvertLogService.name);

  constructor(
    @InjectRepository(ConvertLog)
    private readonly repo: Repository<ConvertLog>,
  ) {}

  /** 记一条转链。失败只警告，绝不阻塞主转链流程 */
  async record(data: {
    userId: number;
    platform: string;
    goodsId: string;
    positionId?: string;
    source?: string;
  }): Promise<void> {
    try {
      if (!data.goodsId) return;
      await this.repo.save(
        this.repo.create({
          userId: data.userId,
          platform: data.platform,
          goodsId: String(data.goodsId),
          positionId: data.positionId ?? '',
          source: data.source ?? 'convert',
        }),
      );
    } catch (e: any) {
      this.logger.warn?.call?.(this.logger, `转链记录写入失败: ${e.message}`);
    }
  }

  /**
   * 兜底归属：按 platform + goodsId 取窗口内最近一条转链的 userId。
   * 找不到返回 null。
   */
  async findAttributor(
    platform: string,
    goodsId: string,
    windowHours = 24 * 7,
  ): Promise<number | null> {
    try {
      const since = new Date(Date.now() - windowHours * 3600_000);
      const row = await this.repo.findOne({
        where: {
          platform,
          goodsId: String(goodsId),
          createdAt: MoreThan(since),
        },
        order: { createdAt: 'DESC' },
      });
      return row?.userId ?? null;
    } catch {
      return null;
    }
  }
}
