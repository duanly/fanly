import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent, AgentStatus, PromotionPosition, User } from '@/entities';
import { genCode, genPositionId } from '@/common/code';
import { PLATFORMS } from '../cps/cps.service';
import { SysConfigService } from '../admin/sys-config.service';

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
    for (const platform of PLATFORMS) {
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
      if (inviteCode) {
        const agent = await this.agentRepo.findOneBy({ agentCode: inviteCode.toUpperCase() });
        if (agent && agent.status === AgentStatus.ACTIVE) agentId = agent.id;
      }
      user = await this.userRepo.save(this.userRepo.create({
        mobile,
        nickname: `用户${mobile.slice(-4)}`,
        inviteCode: genCode(6),
        agentId,
        bindTime: agentId ? new Date() : null,
        deviceId,
      }));
      await this.ensurePositions(user.id);
    } else if (deviceId && !user.deviceId) {
      user.deviceId = deviceId;
      await this.userRepo.save(user);
    }

    if (user.status !== 1) throw new BadRequestException('账号已被冻结');

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
    const agent = await this.agentRepo.findOneBy({ userId });
    let bindAgent = null;
    if (user.agentId) {
      const a = await this.agentRepo.findOneBy({ id: user.agentId });
      bindAgent = a ? { agentCode: a.agentCode, realName: a.realName } : null;
    }
    return {
      id: user.id, mobile: user.mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      nickname: user.nickname, avatar: user.avatar, inviteCode: user.inviteCode,
      balance: user.balance, frozen: user.frozen, pending: user.pending,
      totalRebate: user.totalRebate,
      isAgent: !!agent, agentCode: agent?.agentCode, agentLevel: agent?.level,
      agentStatus: agent?.status,
      bindAgent,
      agentNeedPay: this.cfg.get('agent.need_pay') === '1',
    };
  }
}
