import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent, AgentStatus, PromotionPosition, User } from '@/entities';
import { genCode, genPositionId } from '@/common/code';
import { PLATFORMS } from '../cps/cps.service';
import { SysConfigService } from '../admin/sys-config.service';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** demo 环境用内存验证码；上线换短信服务商 */
  private readonly codes = new Map<string, { code: string; exp: number }>();

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(PromotionPosition) private readonly posRepo: Repository<PromotionPosition>,
    private readonly jwt: JwtService,
    private readonly cfg: SysConfigService,
    private readonly agentSvc: AgentService,
  ) {}

  async sendSms(mobile: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.codes.set(mobile, { code, exp: Date.now() + 5 * 60_000 });
    // 免验证码模式下前端直接填个占位码就能登录
    if (this.skipSmsVerify) {
      this.logger.warn(`⚠️  SKIP_SMS_VERIFY 已开启，${mobile} 无需验证码`);
      return { sent: true, skipVerify: true, devCode: '000000' };
    }
    // TODO 接入短信服务商后在这里发短信
    if (process.env.NODE_ENV === 'production') {
      this.logger.log(`向 ${mobile} 发送验证码`);
      return { sent: true };
    }
    // 开发阶段直接把验证码回给前端，省去真发短信
    this.logger.warn(`[开发模式] ${mobile} 验证码 = ${code}`);
    return { sent: true, devCode: code };
  }

  /** 测试开关：任意验证码都放行。生产环境必须关掉。 */
  private get skipSmsVerify(): boolean {
    return process.env.SKIP_SMS_VERIFY === 'true';
  }

  private verifySms(mobile: string, code: string) {
    if (this.skipSmsVerify) {
      this.logger.warn(
        `⚠️  SKIP_SMS_VERIFY 已开启，${mobile} 未校验验证码直接放行——上线前务必关闭`,
      );
      this.codes.delete(mobile);
      return;
    }
    const rec = this.codes.get(mobile);
    if (!rec || rec.exp < Date.now()) throw new BadRequestException('验证码已过期');
    if (rec.code !== code) throw new BadRequestException('验证码错误');
    this.codes.delete(mobile);
  }

  /** 为新用户建各平台推广位，转链时带上，订单归属靠它 */
  private async ensurePositions(userId: number) {
    const allPlatforms = [...PLATFORMS, 'JTK'];
    for (const platform of allPlatforms) {
      const exist = await this.posRepo.findOneBy({ userId, platform });
      if (!exist) {
        await this.posRepo.save(this.posRepo.create({
          userId, platform, positionId: genPositionId(platform, userId),
        }));
      }
    }
  }

  /**
   * 手机号验证码登录 / 注册。
   * inviteCode 只在首次注册时生效，已注册用户再扫码不换绑。
   */
  async login(mobile: string, smsCode: string, inviteCode?: string, deviceId = '') {
    this.verifySms(mobile, smsCode);

    let user = await this.userRepo.findOneBy({ mobile });
    let isNew = false;

    if (!user) {
      isNew = true;
      let agentId: number | null = null;
      let parentAgentId: number | null = null;
      if (inviteCode) {
        const agent = await this.agentRepo.findOneBy({ agentCode: inviteCode.toUpperCase() });
        if (agent && agent.status === AgentStatus.ACTIVE) {
          agentId = agent.id;
          parentAgentId = agent.id;
        }
      }

      // 生成邀请码（用户和代理共用同一个码）
      let inviteCodeStr = '';
      for (let i = 0; i < 20; i++) {
        const code = genCode(6);
        const [existUser, existAgent] = await Promise.all([
          this.userRepo.findOneBy({ inviteCode: code }),
          this.agentRepo.findOneBy({ agentCode: code }),
        ]);
        if (!existUser && !existAgent) {
          inviteCodeStr = code;
          break;
        }
      }
      if (!inviteCodeStr) throw new BadRequestException('邀请码生成失败，请重试');

      user = await this.userRepo.save(this.userRepo.create({
        mobile,
        nickname: `用户${mobile.slice(-4)}`,
        inviteCode: inviteCodeStr,
        agentId,
        bindTime: agentId ? new Date() : null,
        deviceId,
      }));

      // 自动建 agent 记录（level=0 预备代理，全员都有）
      await this.agentRepo.save(this.agentRepo.create({
        userId: user.id,
        agentCode: inviteCodeStr,
        parentAgentId,
        level: 0,
        status: AgentStatus.ACTIVE,
      }));

      await this.ensurePositions(user.id);

      // 给邀请人发奖励 + 检查升级
      if (parentAgentId) {
        await this.agentSvc.onNewUserInvited(parentAgentId, user.id);
      }
    } else if (deviceId && !user.deviceId) {
      user.deviceId = deviceId;
      await this.userRepo.save(user);
    }

    if (user.status !== 1) throw new BadRequestException('账号已被冻结');

    // 老用户可能缺新平台的推广位（比如后来加的 VIP），补上
    await this.ensurePositions(user.id);

    const agent = await this.agentRepo.findOneBy({ userId: user.id });
    const token = await this.jwt.signAsync({
      sub: user.id, mobile: user.mobile, agentId: agent?.id,
    });
    return {
      token, isNew,
      user: {
        id: user.id, nickname: user.nickname, avatar: user.avatar,
        inviteCode: user.inviteCode, agentId: user.agentId,
        isAgent: !!agent, agentStatus: agent?.status,
      },
    };
  }

  async profile(userId: number) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('用户不存在');
    const agent = await this.agentRepo.findOneBy({ userId });
    let bindAgent = null;
    if (user.agentId) {
      const a = await this.agentRepo.findOneBy({ id: user.agentId });
      bindAgent = a ? { agentCode: a.agentCode, realName: a.realName, level: a.level } : null;
    }

    // 我的邀请人数
    const inviteCount = agent
      ? await this.userRepo.countBy({ agentId: agent.id })
      : 0;

    // 等级名称和升级进度
    const level = agent?.level ?? 0;
    const silver = this.cfg.num('agent.upgrade.silver', 10);
    const gold = this.cfg.num('agent.upgrade.gold', 30);
    const diamond = this.cfg.num('agent.upgrade.diamond', 100);
    const levelNames = ['预备代理', '白银代理', '黄金代理', '钻石代理'];

    // 用户自购返利比例
    const userRebateRate = this.cfg.num('rebate.user_rate', 0.5);
    // 代理分成比例（按等级，预备代理为 0）
    const agentRate = level >= 1
      ? (agent?.agentRate ? Number(agent.agentRate) : this.cfg.num(`rebate.agent_rate.${level}`, 0.12))
      : 0;
    let nextLevel = null;
    let needForNext = 0;
    if (level === 0 && inviteCount < silver) { nextLevel = 1; needForNext = silver - inviteCount; }
    else if (level === 1 && inviteCount < gold) { nextLevel = 2; needForNext = gold - inviteCount; }
    else if (level === 2 && inviteCount < diamond) { nextLevel = 3; needForNext = diamond - inviteCount; }

    return {
      id: user.id, mobile: user.mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      nickname: user.nickname, avatar: user.avatar, inviteCode: user.inviteCode,
      balance: user.balance, frozen: user.frozen, pending: user.pending,
      totalRebate: user.totalRebate,
      coins: user.coins,
      inviteCount,
      isAgent: !!agent && level >= 1,
      agentCode: agent?.agentCode,
      agentLevel: level,
      agentLevelName: levelNames[level] || '预备代理',
      agentStatus: agent?.status ?? 1,
      nextLevel,
      nextLevelName: nextLevel ? levelNames[nextLevel] : null,
      needForNext,
      bindAgent,
      agentNeedPay: this.cfg.get('agent.need_pay') === '1',
      userRebateRate,
      agentRate,
    };
  }

  /** 绑定邀请人，只有尚未绑定的用户才能绑，绑一次后不可改 */
  async bindInviter(userId: number, inviteCode: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (user.agentId) throw new BadRequestException('已经绑定过邀请人了');
    const agent = await this.agentRepo.findOneBy({ agentCode: inviteCode.toUpperCase() });
    if (!agent || agent.status !== AgentStatus.ACTIVE) throw new BadRequestException('邀请码无效');
    if (agent.userId === userId) throw new BadRequestException('不能绑定自己');

    user.agentId = agent.id;
    user.bindTime = new Date();
    await this.userRepo.save(user);

    // 给当前用户创建 agent 记录（level=0 预备代理），纳入代理体系
    // 注册时自动建了，但老用户可能没有，这里补齐
    const myAgent = await this.agentRepo.findOneBy({ userId });
    if (!myAgent) {
      await this.agentRepo.save(this.agentRepo.create({
        userId,
        agentCode: user.inviteCode || genCode(6),
        parentAgentId: agent.id,
        level: 0,
        status: AgentStatus.ACTIVE,
      }));
    } else if (!myAgent.parentAgentId) {
      // 已有 agent 记录但没绑定上级的，补上
      myAgent.parentAgentId = agent.id;
      await this.agentRepo.save(myAgent);
    }

    // 给邀请人发拉新奖励 + 检查升级（和注册时逻辑一致）
    await this.agentSvc.onNewUserInvited(agent.id, userId);

    return { ok: true, agentCode: agent.agentCode, realName: agent.realName };
  }

  /** 更新用户资料（昵称、头像） */
  async updateProfile(userId: number, data: { nickname?: string; avatar?: string }) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('用户不存在');
    if (data.nickname !== undefined) {
      const name = data.nickname.trim();
      if (!name) throw new BadRequestException('昵称不能为空');
      if (name.length > 20) throw new BadRequestException('昵称最多 20 个字符');
      user.nickname = name;
    }
    if (data.avatar !== undefined && data.avatar) {
      user.avatar = data.avatar;
    }
    await this.userRepo.save(user);
    return { ok: true, nickname: user.nickname, avatar: user.avatar };
  }
}
