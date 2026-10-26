import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import {
  Agent, AgentLevelRequest, AgentStatus, CpsOrder,
  LevelRequestStatus, LevelRequestType, OrderStatus, User,
} from '@/entities';
import { CoinType } from '@/entities/coin-ledger.entity';
import { genCode } from '@/common/code';
import { CommissionService } from '../commission/commission.service';
import { SysConfigService } from '../admin/sys-config.service';
import { CoinService } from '../coin/coin.service';
import { SupportService } from '../support/support.service';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CpsOrder) private readonly orderRepo: Repository<CpsOrder>,
    @InjectRepository(AgentLevelRequest)
    private readonly levelReqRepo: Repository<AgentLevelRequest>,
    private readonly commission: CommissionService,
    private readonly cfg: SysConfigService,
    private readonly config: ConfigService,
    private readonly coin: CoinService,
    private readonly support: SupportService,
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

  // ───────── 业绩考核（合规：等级只挂钩真实成交，不挂人头） ─────────

  /** 一级分成：自定义优先，否则按等级模板 */
  private l1Rate(agent: Agent): number {
    if (agent.agentRate) return Number(agent.agentRate);
    return this.cfg.num(`rebate.agent_rate.${agent.level}`,
      agent.level === 3 ? 0.2 : agent.level === 2 ? 0.15 : 0.12);
  }

  /** 考核窗口起点：近 N 天（默认 90） */
  private perfSince(): Date {
    return new Date(Date.now() - this.cfg.num('agent.perf.period_days', 90) * 86400000);
  }

  /** 团队近窗口已结算佣金：CREDITED 状态、剔除退款/失效 */
  private async teamSettledCommission(agentId: number, since: Date): Promise<number> {
    const row = await this.orderRepo.createQueryBuilder('o')
      .select('COALESCE(SUM(o.settleCommission), 0)', 'sum')
      .where('o.agentId = :agentId', { agentId })
      .andWhere('o.orderStatus = :s', { s: OrderStatus.CREDITED })
      .andWhere('o.settleTime >= :since', { since })
      .getRawOne();
    return Number(row.sum);
  }

  /** 业绩 → 建议等级（白银是正式代理的基础级） */
  private levelForPerf(perf: number): number {
    if (perf >= this.cfg.num('agent.perf.diamond', 5000)) return 3;
    if (perf >= this.cfg.num('agent.perf.gold', 1000)) return 2;
    return 1;
  }

  /** 每日扫描所有正式代理；业绩与当前等级不符则生成一条待审 */
  async scanAllLevels() {
    const agents = await this.agentRepo.find({ where: { status: AgentStatus.ACTIVE } });
    let created = 0;
    for (const a of agents) {
      try { if (await this.scanAgent(a)) created++; } catch (e: any) {
        this.logger.error(`代理 ${a.id} 等级扫描失败: ${e.message}`);
      }
    }
    if (created) this.logger.log(`生成 ${created} 条等级审核待办`);
  }

  /** 单个代理扫描；返回是否新建待办 */
  private async scanAgent(agent: Agent): Promise<boolean> {
    if (agent.manualLevel) return false;  // 特批代理豁免
    if (agent.level < 1) return false;   // 预备代理先申请转正
    const since = this.perfSince();
    const perf = await this.teamSettledCommission(agent.id, since);
    const target = this.levelForPerf(perf);
    if (target === agent.level) return false;

    if (target > agent.level) {
      const open = await this.levelReqRepo.findOne({
        where: { agentId: agent.id, toLevel: target, status: LevelRequestStatus.PENDING },
      });
      if (open) return false;  // 同目标有待审，不重复
      // 驳回冷却期内不重复生成
      const cooldown = this.cfg.num('agent.audit.reject_cooldown', 30);
      if (cooldown > 0) {
        const rejected = await this.levelReqRepo.findOne({
          where: { agentId: agent.id, toLevel: target, status: LevelRequestStatus.REJECTED },
          order: { auditedAt: 'DESC' },
        });
        if (rejected?.auditedAt
          && Date.now() - new Date(rejected.auditedAt).getTime() < cooldown * 86400000) {
          return false;
        }
      }
      await this.levelReqRepo.save(this.levelReqRepo.create({
        agentId: agent.id, userId: agent.userId,
        requestType: LevelRequestType.UPGRADE,
        fromLevel: agent.level, toLevel: target,
        perfSnapshot: String(perf),
      }));
      return true;
    }

    // target < level：降级，已有 open 待办则不重复
    const openDown = await this.levelReqRepo.findOne({
      where: {
        agentId: agent.id, status: LevelRequestStatus.PENDING,
        requestType: LevelRequestType.DOWNGRADE,
      },
    });
    if (openDown) return false;

    const graceDays = this.cfg.num('agent.downgrade.grace_days', 15);
    const graceUntil = new Date(Date.now() + graceDays * 86400000);
    await this.levelReqRepo.save(this.levelReqRepo.create({
      agentId: agent.id, userId: agent.userId,
      requestType: LevelRequestType.DOWNGRADE,
      fromLevel: agent.level, toLevel: target,
      perfSnapshot: String(perf),
      graceUntil,
    }));
    // 宽限预警通知：让用户知道截止时间和业绩差额
    try {
      const curThreshold = agent.level === 3
        ? this.cfg.num('agent.perf.diamond', 5000)
        : this.cfg.num('agent.perf.gold', 1000);
      const gap = Math.max(0, Math.ceil(curThreshold - perf));
      const pad = (n: number) => String(n).padStart(2, '0');
      await this.support.sendSystemNotice(agent.userId,
        `⚠️【系统通知】您近 ${this.cfg.num('agent.perf.period_days', 90)} 天推广已结算佣金为 ¥${perf.toFixed(2)}，未达当前等级标准。${graceDays} 天宽限期内（截止 ${graceUntil.getFullYear()}-${pad(graceUntil.getMonth() + 1)}-${pad(graceUntil.getDate())}）再产生 ¥${gap} 已结算佣金即可保留等级。`);
    } catch { /* 通知失败不阻塞 */ }
    return true;
  }

  /** 宽限期满处理：业绩恢复 → 关闭待办；仍不达标 → 自动降级并通知 */
  async processDowngradeGrace() {
    const now = new Date();
    const pending = await this.levelReqRepo.find({
      where: { status: LevelRequestStatus.PENDING, requestType: LevelRequestType.DOWNGRADE },
    });
    for (const req of pending) {
      if (!req.graceUntil || new Date(req.graceUntil) > now) continue;
      try {
        const agent = await this.agentRepo.findOneBy({ id: req.agentId });
        if (!agent || agent.status !== AgentStatus.ACTIVE || agent.manualLevel) {
          req.status = LevelRequestStatus.CANCELED;
          await this.levelReqRepo.save(req);
          continue;
        }
        const perf = await this.teamSettledCommission(agent.id, this.perfSince());
        const target = this.levelForPerf(perf);
        if (target >= agent.level) {
          req.status = LevelRequestStatus.CANCELED;  // 业绩恢复
          await this.levelReqRepo.save(req);
          continue;
        }
        const finalLevel = Math.min(target, req.toLevel);
        agent.level = finalLevel;
        await this.agentRepo.save(agent);
        req.toLevel = finalLevel;
        req.status = LevelRequestStatus.APPROVED;
        req.auditedAt = now;
        req.rejectReason = '宽限期满自动降级';
        await this.levelReqRepo.save(req);
        await this.notifyLevelResult(agent, req);
      } catch (e: any) {
        this.logger.error(`降级待办 ${req.id} 处理失败: ${e.message}`);
      }
    }
  }

  /** 升降级生效后的客服通知（升级 🎉 / 降级说明） */
  private async notifyLevelResult(agent: Agent, req: AgentLevelRequest) {
    const names = ['', '白银', '黄金', '钻石'];
    const ratePct = Math.round(this.l1Rate(agent) * 100);
    const text = req.requestType === LevelRequestType.UPGRADE
      ? `🎉【系统通知】恭喜您已升级为${names[agent.level]}代理！推广分成比例提升至 ${ratePct}%，继续加油～`
      : `【系统通知】您近 ${this.cfg.num('agent.perf.period_days', 90)} 天推广业绩未达标准，等级已调整为${names[agent.level]}代理（分成比例 ${ratePct}%）。业绩重新达标后可再升级，加油～`;
    await this.support.sendSystemNotice(agent.userId, text);
  }

  /** 升降级审核列表（含用户资料） */
  async adminLevelList(q: { status?: number; type?: number; page: number; size: number }) {
    const page = Math.max(q.page || 1, 1);
    const size = Math.min(Math.max(q.size || 20, 5), 50);
    const qb = this.levelReqRepo.createQueryBuilder('r')
      .leftJoin('user', 'u', 'u.id = r.userId')
      .select('r.id', 'id')
      .addSelect('r.agentId', 'agentId')
      .addSelect('r.userId', 'userId')
      .addSelect('r.requestType', 'requestType')
      .addSelect('r.fromLevel', 'fromLevel')
      .addSelect('r.toLevel', 'toLevel')
      .addSelect('r.perfSnapshot', 'perfSnapshot')
      .addSelect('r.graceUntil', 'graceUntil')
      .addSelect('r.status', 'status')
      .addSelect('r.rejectReason', 'rejectReason')
      .addSelect('r.createdAt', 'createdAt')
      .addSelect('r.auditedAt', 'auditedAt')
      .addSelect('u.nickname', 'nickname')
      .addSelect('u.mobile', 'mobile');
    if (q.status !== undefined) qb.andWhere('r.status = :s', { s: q.status });
    if (q.type !== undefined) qb.andWhere('r.requestType = :t', { t: q.type });
    qb.orderBy('r.id', 'DESC')
      .offset((page - 1) * size)
      .limit(size);
    const [list, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);
    return { list, total, page, size };
  }

  /** 人工审核：通过（等级生效+通知）/ 驳回（不主动通知用户） */
  async auditLevel(adminId: number, id: number, pass: boolean, reason: string) {
    const req = await this.levelReqRepo.findOneBy({ id });
    if (!req) throw new BadRequestException('审核记录不存在');
    if (req.status !== LevelRequestStatus.PENDING) throw new BadRequestException('该记录已处理');
    const agent = await this.agentRepo.findOneBy({ id: req.agentId });
    if (!agent) throw new BadRequestException('代理不存在');

    req.auditAdminId = adminId;
    req.auditedAt = new Date();

    if (!pass) {
      req.status = LevelRequestStatus.REJECTED;
      req.rejectReason = String(reason).slice(0, 255);
      await this.levelReqRepo.save(req);
      return { status: req.status };
    }

    agent.level = req.toLevel;
    await this.agentRepo.save(agent);
    req.status = LevelRequestStatus.APPROVED;
    req.rejectReason = '';
    await this.levelReqRepo.save(req);
    try { await this.notifyLevelResult(agent, req); } catch { /* 通知失败不阻塞 */ }
    return { status: req.status, level: agent.level };
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
    // 等级不再在拉新时触发：只按近周期真实业绩每日扫描
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

    const qb = this.userRepo.createQueryBuilder('u')
      .leftJoin('agent', 'a', 'a.userId = u.id')
      .addSelect('a.level', 'agentLevel')
      .where('u.agentId = :agentId', { agentId: agent.id })
      .orderBy('u.id', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const [entities, total] = await qb.getManyAndCount();
    const rawList = await qb.getRawMany();

    const list = entities.map((u, i) => ({
      ...u,
      agentLevel: rawList[i]?.agentLevel != null ? Number(rawList[i].agentLevel) : 0,
      mobile: u.mobile ? u.mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
    }));

    return { list, total, page, size };
  }

  /** 业绩统计 */
  async stats(userId: number, start?: string, end?: string) {
    const agent = await this.agentRepo.findOneBy({ userId });
    if (!agent) throw new BadRequestException('你还不是代理');
    const teamSize = await this.userRepo.countBy({ agentId: agent.id });
    // 二级团队：我发展的代理，他们各自带的人（人数仅展示，不挂钩收益）
    const subAgents = await this.agentRepo.findBy({ parentAgentId: agent.id });
    const teamSizeL2 = subAgents.length
      ? await this.userRepo.count({ where: subAgents.map((a) => ({ agentId: a.id })) })
      : 0;
    const s = await this.commission.agentStats(
      agent.id,
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined,
    );

    const periodDays = this.cfg.num('agent.perf.period_days', 90);
    const since = this.perfSince();
    const perf = agent.level >= 1
      ? await this.teamSettledCommission(agent.id, since) : 0;
    const l2Perf = await this.commission.sumL2SettledCommission(agent.id, since);

    // 待审记录（审核中/宽限中状态）
    const pendingReq = await this.levelReqRepo.findOne({
      where: { agentId: agent.id, status: LevelRequestStatus.PENDING },
      order: { id: 'DESC' },
    });
    const levelRequest = pendingReq ? {
      type: pendingReq.requestType,
      fromLevel: pendingReq.fromLevel,
      toLevel: pendingReq.toLevel,
      graceUntil: pendingReq.graceUntil,
    } : null;

    // 一级下一档进度：无待审、非特批、非最高级时
    let nextLevel = null;
    if (!levelRequest && !agent.manualLevel && agent.level < 3) {
      const need = agent.level === 1
        ? this.cfg.num('agent.perf.gold', 1000)
        : this.cfg.num('agent.perf.diamond', 5000);
      if (perf < need) {
        nextLevel = {
          needPerf: need,
          perf: Math.round(perf * 100) / 100,
          gap: Math.max(0, Math.ceil(need - perf)),
        };
      }
    }

    // 二级下一档（手动配置二级比例时不提示）
    let l2Next = null;
    if (agent.agentRateL2 == null) {
      const l2Tiers = [
        { perf: this.cfg.num('agent.l2.perf_t1', 500), rate: 0.02 },
        { perf: this.cfg.num('agent.l2.perf_t2', 2000), rate: 0.03 },
        { perf: this.cfg.num('agent.l2.perf_t3', 8000), rate: 0.04 },
      ];
      const hit = l2Tiers.find((t) => l2Perf < t.perf);
      if (hit) {
        l2Next = {
          needPerf: hit.perf, rate: hit.rate,
          gap: Math.max(0, Math.ceil(hit.perf - l2Perf)),
        };
      }
    }

    return {
      agentCode: agent.agentCode,
      level: agent.level,
      levelName: ['预备代理', '白银代理', '黄金代理', '钻石代理'][agent.level],
      manualLevel: agent.manualLevel,
      rate: String(this.l1Rate(agent)),
      periodDays,
      perf: Math.round(perf * 100) / 100,
      l2Perf: Math.round(l2Perf * 100) / 100,
      teamSize,
      subAgentCount: subAgents.length,
      teamSizeL2,
      rateL2: String(await this.commission.l2RateForAgent(agent.id)),
      rateL2Manual: agent.agentRateL2 != null,
      levelRequest,
      nextLevel,
      l2Next,
      ...s,
    };
  }

  // ---- 后台 ----
  async adminList(q: { status?: number; keyword?: string; minLevel?: number; page?: number; size?: number }) {
    const { page = 1, size = 20 } = q;
    const qb = this.agentRepo.createQueryBuilder('a')
      .leftJoin('user', 'u', 'u.id = a.userId');
    if (q.status !== undefined) qb.andWhere('a.status = :status', { status: q.status });
    if (q.minLevel) qb.andWhere('a.level >= :minLevel', { minLevel: q.minLevel });
    if (q.keyword) {
      qb.andWhere('(u.mobile LIKE :kw OR u.nickname LIKE :kw OR a.agentCode LIKE :kw OR a.realName LIKE :kw)', {
        kw: `%${q.keyword}%`,
      });
    }
    qb.orderBy('a.id', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const [list, total] = await qb.getManyAndCount();
    const enriched = await Promise.all(list.map(async (a) => {
      const u = await this.userRepo.findOneBy({ id: a.userId });
      return {
        ...a,
        mobile: u?.mobile || '',
        nickname: u?.nickname || '',
        teamSize: await this.userRepo.countBy({ agentId: a.id }),
        teamSizeL2: await this.commission.countTeamSizeL2(a.id),
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

  // ---- 用户管理后台 ----

  /**
   * 用户列表（后台用）：基本信息 + 代理等级 + 上级 + 消费/返利统计
   */
  async adminUserList(q: {
    keyword?: string;
    agentId?: number;
    minLevel?: number;
    page?: number;
    size?: number;
  }) {
    const { page = 1, size = 20 } = q;
    const qb = this.userRepo.createQueryBuilder('u')
      .leftJoin('agent', 'a', 'a.id = u.agentId')
      .leftJoin('agent', 'pa', 'pa.id = a.parentAgentId')
      .leftJoin('user', 'pu', 'pu.id = pa.userId')
      .addSelect('a.level', 'agentLevel')
      .addSelect('a.agentCode', 'agentCode')
      .addSelect('a.manualLevel', 'agentManualLevel')
      .addSelect('pa.agentCode', 'parentAgentCode')
      .addSelect('pu.nickname', 'parentNickname')
      .addSelect('pu.mobile', 'parentMobile');

    if (q.keyword) {
      qb.andWhere('(u.mobile LIKE :kw OR u.nickname LIKE :kw OR u.inviteCode LIKE :kw)', {
        kw: `%${q.keyword}%`,
      });
    }
    if (q.agentId) qb.andWhere('u.agentId = :agentId', { agentId: q.agentId });
    if (q.minLevel) qb.andWhere('a.level >= :minLevel', { minLevel: q.minLevel });

    qb.orderBy('u.id', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const [entities, total] = await qb.getManyAndCount();
    const rawList = await qb.getRawMany();

    // 批量查订单统计（消费总额 + 订单数 + 返利总额）
    const userIds = entities.map((u) => u.id);
    const orderStats = userIds.length > 0
      ? await this.orderRepo
          .createQueryBuilder('o')
          .select('o.userId', 'userId')
          .addSelect('COALESCE(SUM(o.payAmount), 0)', 'totalSpend')
          .addSelect('COUNT(o.id)', 'orderCount')
          .addSelect('COALESCE(SUM(o.settleCommission), 0)', 'totalCommission')
          .where('o.userId IN (:...userIds)', { userIds })
          .andWhere('o.orderStatus != :invalidStatus', { invalidStatus: 4 })
          .groupBy('o.userId')
          .getRawMany()
      : [];
    const statsMap = new Map(orderStats.map((s) => [Number(s.userId), s]));

    const list = entities.map((u, i) => {
      const raw = rawList[i] || {};
      const stats = statsMap.get(u.id) || { totalSpend: 0, orderCount: 0, totalCommission: 0 };
      return {
        ...u,
        agentLevel: raw.agentLevel != null ? Number(raw.agentLevel) : null,
        agentCode: raw.agentCode || null,
        agentManualLevel: raw.agentManualLevel ? Boolean(raw.agentManualLevel) : false,
        parentAgentCode: raw.parentAgentCode || null,
        parentNickname: raw.parentNickname || null,
        parentMobile: raw.parentMobile || null,
        totalSpend: Number(stats.totalSpend || 0).toFixed(2),
        orderCount: Number(stats.orderCount || 0),
        totalCommission: Number(stats.totalCommission || 0).toFixed(2),
      };
    });

    return { list, total, page, size };
  }
}
