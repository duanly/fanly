import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Agent, AgentStatus, CpsOrder, OrderStatus, User } from '@/entities';
import { CoinType } from '@/entities/coin-ledger.entity';
import { genCode } from '@/common/code';
import { CommissionService } from '../commission/commission.service';
import { SysConfigService } from '../admin/sys-config.service';
import { CoinService } from '../coin/coin.service';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CpsOrder) private readonly orderRepo: Repository<CpsOrder>,
    private readonly commission: CommissionService,
    private readonly cfg: SysConfigService,
    private readonly config: ConfigService,
    private readonly coin: CoinService,
  ) {}

  /**
   * 启动时补齐数据：
   * 1. 所有有 user 记录但没有 agent 记录的，补一条 level=0 的预备代理
   * 2. agent.agentCode 和 user.inviteCode 不一致的，以 user.inviteCode 为准同步
   *    （保证用户端和管理后台看到的是同一个码）
   */
  async onModuleInit() {
    try {
      const users = await this.userRepo.find();
      let created = 0;
      let synced = 0;
      for (const u of users) {
        let agent = await this.agentRepo.findOneBy({ userId: u.id });
        if (!agent) {
          // 补齐 agent 记录
          agent = await this.agentRepo.save(this.agentRepo.create({
            userId: u.id,
            agentCode: u.inviteCode || (await this.uniqueCode()),
            parentAgentId: u.agentId ?? null,
            level: 0,
            status: AgentStatus.ACTIVE,
          }));
          created++;
        } else if (u.inviteCode && agent.agentCode !== u.inviteCode) {
          // 码不一致：以 user.inviteCode 为准同步到 agent
          // 先确认不会冲突
          const conflict = await this.agentRepo.findOneBy({ agentCode: u.inviteCode });
          if (!conflict || conflict.id === agent.id) {
            agent.agentCode = u.inviteCode;
            await this.agentRepo.save(agent);
            synced++;
          } else {
            this.logger.warn(
              `用户 ${u.id} 的 inviteCode=${u.inviteCode} 与 agent ${conflict.id} 冲突，跳过同步`,
            );
          }
        }
      }
      if (created > 0 || synced > 0) {
        this.logger.log(`代理数据补齐：新增 ${created} 条，同步邀请码 ${synced} 条`);
      }
    } catch (e: any) {
      this.logger.error(`启动时补齐 agent 数据失败: ${e.message}`);
    }
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = genCode(6);
      if (!(await this.agentRepo.findOneBy({ agentCode: code }))) return code;
    }
    throw new BadRequestException('推广码生成失败，请重试');
  }

  /** 申请成为代理。代理免费，不收加盟费。 */
  async apply(userId: number, realName = '') {
    const exist = await this.agentRepo.findOneBy({ userId });
    if (exist) return exist;

    // 谁把他拉进来的，谁就是他的上级——二级分销的链条在这里成形。
    // 用注册时绑定的 agentId，之后再改绑不影响已有的上下级关系
    const me = await this.userRepo.findOneBy({ id: userId });
    const parentAgentId = me?.agentId ?? null;

    return this.agentRepo.save(this.agentRepo.create({
      userId,
      agentCode: await this.uniqueCode(),
      realName,
      parentAgentId,
      status: AgentStatus.PENDING,
    }));
  }

  async findByCode(agentCode: string) {
    return this.agentRepo.findOneBy({ agentCode });
  }

  async findByUser(userId: number) {
    return this.agentRepo.findOneBy({ userId });
  }

  /** 通过 inviteCode 找用户（用于邀请落地页） */
  async findUserByInviteCode(inviteCode: string) {
    return this.userRepo.findOneBy({ inviteCode: inviteCode.toUpperCase() });
  }

  /** 全员推广二维码：每个用户都有，用自己的 inviteCode */
  async inviteQrcode(userId: number) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('用户不存在');
    const base = this.config.get('H5_BASE_URL', 'http://localhost:5173');
    const url = `${base}/i/${user.inviteCode}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
    return { inviteCode: user.inviteCode, url, qrcode: dataUrl };
  }

  /** 直属邀请人数 */
  async inviteCount(userId: number) {
    const agent = await this.agentRepo.findOneBy({ userId });
    if (!agent) return 0;
    return this.userRepo.countBy({ agentId: agent.id });
  }

  /**
   * 检查是否升级。每次有新成员加入时调用。
   * 只升不降，达到更高等级就升。
   */
  async checkAndUpgrade(agentId: number | null) {
    if (!agentId) return null;
    const agent = await this.agentRepo.findOneBy({ id: agentId });
    if (!agent || agent.status !== AgentStatus.ACTIVE) return null;
    // 手动设置等级的代理，自动升级不生效（手动优先级更高）
    if (agent.manualLevel) return null;

    const count = await this.userRepo.countBy({ agentId });
    const silver = this.cfg.num('agent.upgrade.silver', 10);
    const gold = this.cfg.num('agent.upgrade.gold', 30);
    const diamond = this.cfg.num('agent.upgrade.diamond', 100);

    let targetLevel = agent.level;
    if (count >= diamond) targetLevel = 3;
    else if (count >= gold) targetLevel = 2;
    else if (count >= silver) targetLevel = 1;

    if (targetLevel > agent.level) {
      agent.level = targetLevel;
      await this.agentRepo.save(agent);
      return agent;
    }
    return null;
  }

  /**
   * 新用户注册时给邀请人发奖励，并触发升级检查。
   * 由 auth.service 调用。
   */
  async onNewUserInvited(inviterAgentId: number | null, newUserId: number) {
    if (!inviterAgentId) return;
    // 拉新金币奖励
    const reward = this.cfg.num('coin.invite_reward', 100);
    if (reward > 0) {
      try {
        const inviterAgent = await this.agentRepo.findOneBy({ id: inviterAgentId });
        if (inviterAgent) {
          await this.coin.addCoins(inviterAgent.userId, reward, CoinType.INVITE,
            `邀请好友注册奖励`);
        }
      } catch {
        // 发奖励失败不影响注册流程
      }
    }
    // 检查升级
    try {
      await this.checkAndUpgrade(inviterAgentId);
    } catch {
      // ignore
    }
  }

  /** 专属二维码：内容 = H5 落地页 + 推广码 */
  async qrcode(userId: number) {
    const agent = await this.agentRepo.findOneBy({ userId });
    if (!agent) throw new BadRequestException('你还不是代理');
    const base = this.config.get('H5_BASE_URL', 'http://localhost:5173');
    const url = `${base}/i/${agent.agentCode}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
    return { agentCode: agent.agentCode, url, qrcode: dataUrl };
  }

  /** 我的团队（全员可用） */
  async team(userId: number, page = 1, size = 20) {
    const agent = await this.agentRepo.findOneBy({ userId });
    if (!agent) return { list: [], total: 0, page, size };
    const [list, total] = await this.userRepo.findAndCount({
      where: { agentId: agent.id }, order: { id: 'DESC' },
      skip: (page - 1) * size, take: size,
      select: ['id', 'nickname', 'mobile', 'createdAt', 'totalRebate'],
    });
    return {
      list: list.map((u) => ({
        ...u,
        mobile: u.mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      })),
      total, page, size,
    };
  }

  /** 业绩统计 */
  async stats(userId: number, start?: string, end?: string) {
    const agent = await this.agentRepo.findOneBy({ userId });
    if (!agent) throw new BadRequestException('你还不是代理');
    const teamSize = await this.userRepo.countBy({ agentId: agent.id });
    // 二级团队：我发展的代理，他们各自带的人
    const subAgents = await this.agentRepo.findBy({ parentAgentId: agent.id });
    const teamSizeL2 = subAgents.length
      ? await this.userRepo.count({ where: subAgents.map((a) => ({ agentId: a.id })) })
      : 0;
    const s = await this.commission.agentStats(
      agent.id,
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined,
    );
    return {
      agentCode: agent.agentCode,
      level: agent.level,
      levelName: ['', '普通代理', '高级代理', '合伙人'][agent.level],
      rate: agent.agentRate ?? String(this.cfg.num(`rebate.agent_rate.${agent.level}`, agent.level === 3 ? 0.2 : agent.level === 2 ? 0.15 : 0.12)),
      teamSize,
      subAgentCount: subAgents.length,
      teamSizeL2,
      rateL2: String(this.cfg.num('rebate.agent_rate_l2', 0.05)),
      ...s,
    };
  }

  /** 月初重算等级：按上月有效订单数，连续两月不达标才降 */
  async recalcLevels() {
    const agents = await this.agentRepo.find({ where: { status: AgentStatus.ACTIVE } });
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const up2 = this.cfg.num('agent.level_up.2', 100);
    const up3 = this.cfg.num('agent.level_up.3', 500);

    for (const a of agents) {
      const count = await this.orderRepo.createQueryBuilder('o')
        .where('o.agentId = :id AND o.orderTime >= :start AND o.orderTime < :end', { id: a.id, start, end })
        .andWhere('o.orderStatus != :invalid', { invalid: OrderStatus.INVALID })
        .getCount();
      const target = count >= up3 ? 3 : count >= up2 ? 2 : 1;
      if (target > a.level) { a.level = target; await this.agentRepo.save(a); }
    }
  }

  // ---- 后台 ----
  async adminList(status?: number, page = 1, size = 20) {
    const where: any = {};
    if (status !== undefined) where.status = status;
    const [list, total] = await this.agentRepo.findAndCount({
      where, order: { id: 'DESC' }, skip: (page - 1) * size, take: size,
    });
    const enriched = await Promise.all(list.map(async (a) => {
      const u = await this.userRepo.findOneBy({ id: a.userId });
      return {
        ...a,
        mobile: u?.mobile || '',
        nickname: u?.nickname || '',
        teamSize: await this.userRepo.countBy({ agentId: a.id }),
        stats: await this.commission.agentStats(a.id),
      };
    }));
    return { list: enriched, total, page, size };
  }

  async adminUpdate(id: number, patch: Partial<Agent> & { manualLevel?: boolean }) {
    const agent = await this.agentRepo.findOneBy({ id });
    if (!agent) throw new BadRequestException('代理不存在');
    // 手动调整等级时，自动标记为手动设置（优先级高于自动升级）
    if (patch.level !== undefined && patch.level !== agent.level) {
      agent.manualLevel = true;
    }
    // 如果显式传了 manualLevel，按传的值来（管理员可以取消手动标记回到自动模式）
    if (patch.manualLevel !== undefined) {
      agent.manualLevel = patch.manualLevel;
      delete patch.manualLevel;
    }
    Object.assign(agent, patch);
    return this.agentRepo.save(agent);
  }
}
