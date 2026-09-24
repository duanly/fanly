import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Agent, AgentStatus, CpsOrder, OrderStatus, User } from '@/entities';
import { genCode } from '@/common/code';
import { CommissionService } from '../commission/commission.service';
import { SysConfigService } from '../admin/sys-config.service';

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CpsOrder) private readonly orderRepo: Repository<CpsOrder>,
    private readonly commission: CommissionService,
    private readonly cfg: SysConfigService,
    private readonly config: ConfigService,
  ) {}

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

  /** 专属二维码：内容 = H5 落地页 + 推广码 */
  async qrcode(userId: number) {
    const agent = await this.agentRepo.findOneBy({ userId });
    if (!agent) throw new BadRequestException('你还不是代理');
    const base = this.config.get('H5_BASE_URL', 'http://localhost:5173');
    const url = `${base}/i/${agent.agentCode}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
    return { agentCode: agent.agentCode, url, qrcode: dataUrl };
  }

  /** 我的团队 */
  async team(userId: number, page = 1, size = 20) {
    const agent = await this.agentRepo.findOneBy({ userId });
    if (!agent) throw new BadRequestException('你还不是代理');
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
      rate: agent.agentRate ?? String(this.cfg.num(`rebate.agent_rate.${agent.level}`, 0.1)),
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
    const enriched = await Promise.all(list.map(async (a) => ({
      ...a,
      teamSize: await this.userRepo.countBy({ agentId: a.id }),
      stats: await this.commission.agentStats(a.id),
    })));
    return { list: enriched, total, page, size };
  }

  async adminUpdate(id: number, patch: Partial<Agent>) {
    const agent = await this.agentRepo.findOneBy({ id });
    if (!agent) throw new BadRequestException('代理不存在');
    Object.assign(agent, patch);
    return this.agentRepo.save(agent);
  }
}
