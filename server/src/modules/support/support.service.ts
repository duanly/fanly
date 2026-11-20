import {
  BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  SupportAutoReply, SupportConversation, SupportMatchType, SupportMessage,
  SupportMsgType, SupportSender, User,
} from '@/entities';
import { SysConfigService } from '../admin/sys-config.service';
import { SupportGateway } from './support.gateway';

const GUEST_NICKNAME = '访客（未登录）';
/** 同一 IP 每小时最多新建多少条访客会话 / 每条访客会话每分钟最多发多少条消息 */
const GUEST_START_PER_HOUR = 20;
const GUEST_MSG_PER_MINUTE = 20;

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  /** 访客接口是公开的，用内存滑动窗口挡一下刷量（单实例部署够用） */
  private readonly rateHits = new Map<string, number[]>();
  private defaultReplyRunning = false;

  constructor(
    @InjectRepository(SupportConversation) private readonly convRepo: Repository<SupportConversation>,
    @InjectRepository(SupportMessage) private readonly msgRepo: Repository<SupportMessage>,
    @InjectRepository(SupportAutoReply) private readonly ruleRepo: Repository<SupportAutoReply>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly cfg: SysConfigService,
    private readonly gateway: SupportGateway,
  ) {}

  // ---- 序列化 ----

  private msgJson(m: SupportMessage) {
    return {
      id: m.id,
      senderType: m.senderType,
      senderAdminId: m.senderAdminId,
      type: m.type,
      content: m.content,
      createdAt: m.createdAt,
    };
  }

  /** 会话摘要：列表行 + WS 推送共用 */
  private convSummary(conv: SupportConversation, user?: User | null) {
    return {
      id: conv.id,
      userId: conv.userId,
      staffUnread: conv.staffUnread,
      userUnread: conv.userUnread,
      lastMessage: conv.lastMessage,
      lastMessageType: conv.lastMessageType,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      guest: !conv.userId,
      nickname: conv.userId ? (user?.nickname ?? '') : GUEST_NICKNAME,
      mobile: conv.userId ? (user?.mobile ?? '') : this.guestMobileLabel(conv.guestMobile),
      avatar: user?.avatar ?? '',
    };
  }

  /** 访客手机号是自报的，客服端展示时带上「未验证」提醒 */
  private guestMobileLabel(mobile: string | null | undefined) {
    return mobile ? `${mobile}（自报未验证）` : '';
  }

  /** 会话归属的注册用户；访客会话没有（userId 为空时绝不能拿去 findOneBy，会查出第一行） */
  private async ownerUser(conv: SupportConversation): Promise<User | null> {
    return conv.userId ? this.userRepo.findOneBy({ id: conv.userId }) : null;
  }

  /** 推给会话的用户侧：登录用户走用户房间，访客走访客会话房间 */
  private emitToOwner(conv: SupportConversation, event: string, data: unknown) {
    if (conv.userId) this.gateway.emitToUser(conv.userId, event, data);
    else this.gateway.emitToGuest(conv.id, event, data);
  }

  /** 滑动窗口限流：窗口内超过 max 次返回 false */
  private hit(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const arr = (this.rateHits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { this.rateHits.set(key, arr); return false; }
    arr.push(now);
    this.rateHits.set(key, arr);
    if (this.rateHits.size > 5000) {
      for (const [k, v] of this.rateHits) {
        if (!v.length || now - v[v.length - 1] > 3600_000) this.rateHits.delete(k);
      }
    }
    return true;
  }

  private async listMessages(convId: number) {
    const rows = await this.msgRepo.find({
      where: { conversationId: convId },
      order: { id: 'ASC' },
    });
    return rows.map((m) => this.msgJson(m));
  }

  /** 校验消息载荷：文本 ≤1000 字；图片只接受本站 /uploads/ 路径 */
  private validatePayload(type: unknown, content: unknown): { t: number; c: string } {
    const t = Number(type);
    if (t !== SupportMsgType.TEXT && t !== SupportMsgType.IMAGE) {
      throw new BadRequestException('消息类型不正确');
    }
    const c = String(content ?? '').trim();
    if (!c) throw new BadRequestException('消息内容不能为空');
    if (t === SupportMsgType.TEXT) {
      if (c.length > 1000) throw new BadRequestException('消息不能超过 1000 字');
    } else if (!/^\/uploads\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(c)) {
      throw new BadRequestException('图片地址不合法');
    }
    return { t, c };
  }

  // ---- 用户端 ----

  /** 新会话落一条欢迎语，用户打开就看得到问候（不计未读、不推送，调用方随后整页返回） */
  private async addWelcome(conv: SupportConversation) {
    const welcome = this.cfg.get('support.welcome', '').trim();
    if (!welcome) return;
    const text = welcome.slice(0, 1000);
    const wm = await this.msgRepo.save(this.msgRepo.create({
      conversationId: conv.id,
      senderType: SupportSender.AUTO,
      type: SupportMsgType.TEXT,
      content: text,
    }));
    conv.lastMessage = text.slice(0, 255);
    conv.lastMessageType = SupportMsgType.TEXT;
    conv.lastMessageAt = wm.createdAt;
    await this.convRepo.save(conv);
  }

  /** 进入客服页：find-or-create；新建时立刻落一条欢迎语 */
  async getUserConversation(userId: number) {
    let conv = await this.convRepo.findOneBy({ userId });
    if (!conv) {
      conv = await this.convRepo.save(this.convRepo.create({ userId }));
      await this.addWelcome(conv);
    }
    return { conversation: this.convSummary(conv), messages: await this.listMessages(conv.id) };
  }

  /** 用户发消息（文本才触发关键词自动回复，图片只通知人工） */
  async userSend(userId: number, type: unknown, content: unknown) {
    const { t, c } = this.validatePayload(type, content);
    let conv = await this.convRepo.findOneBy({ userId });
    if (!conv) conv = await this.convRepo.save(this.convRepo.create({ userId }));
    return this.acceptUserMessage(conv, t, c);
  }

  /**
   * 用户侧（登录用户/访客）消息统一入口：落库 → 通知客服 → 自动回复。
   * 自动回复顺序：关键词规则 → 兜底语 → 首次咨询的默认回复；
   * 都没回上的，由 flushDefaultReplies 在超时后补一条默认回复。
   */
  private async acceptUserMessage(conv: SupportConversation, t: number, c: string) {
    const isFirstContact = (await this.msgRepo.count({
      where: { conversationId: conv.id, senderType: SupportSender.USER },
    })) === 0;

    const msg = await this.msgRepo.save(this.msgRepo.create({
      conversationId: conv.id,
      senderType: SupportSender.USER,
      type: t,
      content: c,
    }));
    conv.lastMessage = t === SupportMsgType.IMAGE ? '[图片]' : c.slice(0, 255);
    conv.lastMessageType = t;
    conv.lastMessageAt = msg.createdAt;
    conv.staffUnread += 1;
    if (!conv.pendingSince) conv.pendingSince = new Date();
    await this.convRepo.save(conv);

    const user = await this.ownerUser(conv);
    const summary = this.convSummary(conv, user);
    this.gateway.emitToStaff('support:message', {
      message: this.msgJson(msg), conversation: summary,
    });

    if (this.cfg.get('support.auto_reply', '1') === '1') {
      let replied = false;
      if (t === SupportMsgType.TEXT) replied = await this.runAutoReply(conv, user, c);
      if (!replied && isFirstContact) await this.sendDefaultReply(conv, user);
    }
    return { message: this.msgJson(msg), conversation: summary };
  }

  /** 规则匹配 → 落自动回复；未命中且有兜底语则用兜底。返回是否回复了 */
  private async runAutoReply(conv: SupportConversation, user: User | null, userText: string) {
    const norm = userText.trim().toLowerCase();
    const rules = await this.ruleRepo.find({ where: { enabled: true } });
    rules.sort((a, b) => b.priority - a.priority || a.id - b.id);

    let replyText = '';
    for (const r of rules) {
      const kw = r.keyword.trim().toLowerCase();
      const hit = r.matchType === SupportMatchType.EXACT
        ? norm === kw
        : norm.includes(kw);
      if (hit) { replyText = r.reply.trim(); break; }
    }
    if (!replyText) replyText = this.cfg.get('support.fallback', '').trim();
    if (!replyText) return false;
    await this.deliverAutoReply(conv, user, replyText.slice(0, 1000));
    return true;
  }

  /**
   * 默认回复（support.default_reply）：首次咨询立即发；之后用户消息超时没人回再发。
   * 发过一次后要等人工回复才复位，客服不在时不会每条消息都回同一句。
   */
  private async sendDefaultReply(conv: SupportConversation, user: User | null) {
    if (conv.defaultReplied) return false;
    const text = this.cfg.get('support.default_reply', '').trim();
    if (!text) return false;
    conv.defaultReplied = true;
    await this.deliverAutoReply(conv, user, text.slice(0, 1000));
    return true;
  }

  /** 定时扫描：用户消息超过 support.default_reply_delay 秒没人回，先发默认回复 */
  @Interval(10_000)
  async flushDefaultReplies() {
    if (this.defaultReplyRunning) return;
    this.defaultReplyRunning = true;
    try {
      const delaySec = Math.max(this.cfg.num('support.default_reply_delay', 60), 10);
      const due = await this.convRepo.find({
        where: { pendingSince: LessThanOrEqual(new Date(Date.now() - delaySec * 1000)) },
        take: 100,
      });
      const enabled = this.cfg.get('support.auto_reply', '1') === '1';
      for (const conv of due) {
        // 原子认领：这期间客服刚好回了（pendingSince 已清空）就不再补发
        const claimed = await this.convRepo.update(
          { id: conv.id, pendingSince: Not(IsNull()) },
          { pendingSince: null },
        );
        if (!claimed.affected) continue;
        conv.pendingSince = null;
        if (!enabled) continue;
        try {
          await this.sendDefaultReply(conv, await this.ownerUser(conv));
        } catch (e: any) {
          this.logger.error(`默认回复发送失败 conv=${conv.id}: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`默认回复扫描失败: ${e.message}`);
    } finally {
      this.defaultReplyRunning = false;
    }
  }

  /** 自动回复落库并双向推送（客服端也要看得到系统替他说了什么） */
  private async deliverAutoReply(conv: SupportConversation, user: User | null, text: string) {
    const msg = await this.msgRepo.save(this.msgRepo.create({
      conversationId: conv.id,
      senderType: SupportSender.AUTO,
      type: SupportMsgType.TEXT,
      content: text,
    }));
    conv.lastMessage = text.slice(0, 255);
    conv.lastMessageType = SupportMsgType.TEXT;
    conv.lastMessageAt = msg.createdAt;
    conv.userUnread += 1;
    conv.pendingSince = null;
    await this.convRepo.save(conv);

    const summary = this.convSummary(conv, user);
    const payload = { message: this.msgJson(msg), conversation: summary };
    this.emitToOwner(conv, 'support:message', payload);
    this.gateway.emitToStaff('support:message', payload);
  }

  // ---- 访客端（未登录：忘记密码联系客服） ----

  private async guestConv(guestKey: unknown): Promise<SupportConversation> {
    const key = typeof guestKey === 'string' ? guestKey.trim() : '';
    const conv = key && key.length <= 64 ? await this.convRepo.findOneBy({ guestKey: key }) : null;
    if (!conv) throw new NotFoundException('会话不存在或已失效');
    return conv;
  }

  /**
   * 访客发起/续接会话。手机号只是访客自报，仅作为客服核实身份的线索。
   * 新建（或换了手机号）时替访客发一条说明来意的消息，客服列表里立刻有未读。
   */
  async guestStart(ip: string, mobile: unknown, guestKey?: unknown) {
    const m = String(mobile ?? '').trim();
    if (!/^1[3-9]\d{9}$/.test(m)) throw new BadRequestException('手机号格式不对');

    let conv = typeof guestKey === 'string' && guestKey
      ? await this.convRepo.findOneBy({ guestKey: guestKey.trim().slice(0, 64) })
      : null;
    const isNew = !conv;
    if (!conv) {
      if (!this.hit(`guest-start:${ip}`, GUEST_START_PER_HOUR, 3600_000)) {
        throw new HttpException('操作太频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
      }
      conv = await this.convRepo.save(this.convRepo.create({
        userId: null,
        guestKey: randomBytes(24).toString('hex'),
        guestMobile: m,
      }));
      await this.addWelcome(conv);
    }
    if (isNew || conv.guestMobile !== m) {
      if (!this.hit(`guest-msg:${conv.id}`, GUEST_MSG_PER_MINUTE, 60_000)) {
        throw new HttpException('操作太频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
      }
      conv.guestMobile = m;
      await this.acceptUserMessage(
        conv, SupportMsgType.TEXT, `【忘记密码】我的注册手机号是 ${m}，请帮我重置密码。`,
      );
    }
    return {
      guestKey: conv.guestKey,
      conversation: this.convSummary(conv),
      messages: await this.listMessages(conv.id),
    };
  }

  async guestConversation(guestKey: unknown) {
    const conv = await this.guestConv(guestKey);
    return { conversation: this.convSummary(conv), messages: await this.listMessages(conv.id) };
  }

  /** 访客只能发文本（图片上传接口需要登录） */
  async guestSend(guestKey: unknown, content: unknown) {
    const { t, c } = this.validatePayload(SupportMsgType.TEXT, content);
    const conv = await this.guestConv(guestKey);
    if (!this.hit(`guest-msg:${conv.id}`, GUEST_MSG_PER_MINUTE, 60_000)) {
      throw new HttpException('发送太频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.acceptUserMessage(conv, t, c);
  }

  async guestRead(guestKey: unknown) {
    const conv = await this.guestConv(guestKey);
    if (conv.userUnread > 0) {
      conv.userUnread = 0;
      await this.convRepo.save(conv);
    }
  }

  async markUserRead(userId: number) {
    const conv = await this.convRepo.findOneBy({ userId });
    if (conv && conv.userUnread > 0) {
      conv.userUnread = 0;
      await this.convRepo.save(conv);
    }
  }

  /** 未读数：没有会话就是 0，绝不在这里创建会话（避免「我的」页把空会话刷进客服列表） */
  async getUnread(userId: number) {
    const conv = await this.convRepo.findOneBy({ userId });
    return { count: conv?.userUnread ?? 0 };
  }

  /**
   * 系统通知：自动建/复用客服会话，插入一条「系统通知」消息（代理升降级等官方通知的统一通道）。
   * 用户未读 +1，实时推送；客服端会话里也看得到这条官方通知。
   */
  async sendSystemNotice(userId: number, text: string) {
    const content = text.trim().slice(0, 1000);
    if (!content) throw new BadRequestException('通知内容不能为空');

    let conv = await this.convRepo.findOneBy({ userId });
    if (!conv) conv = await this.convRepo.save(this.convRepo.create({ userId }));

    const msg = await this.msgRepo.save(this.msgRepo.create({
      conversationId: conv.id,
      senderType: SupportSender.SYSTEM,
      type: SupportMsgType.TEXT,
      content,
    }));
    conv.lastMessage = content.slice(0, 255);
    conv.lastMessageType = SupportMsgType.TEXT;
    conv.lastMessageAt = msg.createdAt;
    conv.userUnread += 1;
    await this.convRepo.save(conv);

    const payload = { message: this.msgJson(msg), conversation: this.convSummary(conv, null) };
    this.gateway.emitToUser(userId, 'support:message', payload);
    this.gateway.emitToStaff('support:message', payload);
    return payload;
  }

  /** 客服未读总条数（入口角标用；一次 SUM 不拉列表） */
  async staffUnreadTotal() {
    const row = await this.convRepo.createQueryBuilder('c')
      .select('COALESCE(SUM(c.staffUnread), 0)', 'total')
      .getRawOne();
    return { total: Number(row.total) };
  }

  // ---- 客服端 ----

  /** 客服会话列表（含用户资料），按最后消息时间倒序 */
  async staffList(opts: { keyword?: string; page?: number; size?: number }) {
    const page = Math.max(Number(opts.page) || 1, 1);
    const size = Math.min(Math.max(Number(opts.size) || 20, 5), 50);

    const qb = this.convRepo.createQueryBuilder('c')
      .leftJoin('user', 'u', 'u.id = c.userId')
      .select('c.id', 'id')
      .addSelect('c.userId', 'userId')
      .addSelect('c.staffUnread', 'staffUnread')
      .addSelect('c.userUnread', 'userUnread')
      .addSelect('c.lastMessage', 'lastMessage')
      .addSelect('c.lastMessageType', 'lastMessageType')
      .addSelect('c.lastMessageAt', 'lastMessageAt')
      .addSelect('c.createdAt', 'createdAt')
      .addSelect('u.nickname', 'nickname')
      .addSelect('u.mobile', 'mobile')
      .addSelect('u.avatar', 'avatar')
      .addSelect('c.guestMobile', 'guestMobile');
    if (opts.keyword) {
      qb.andWhere(
        '(u.mobile LIKE :kw OR u.nickname LIKE :kw OR c.guestMobile LIKE :kw)',
        { kw: `%${opts.keyword}%` },
      );
    }
    qb.orderBy('c.lastMessageAt', 'DESC')
      .offset((page - 1) * size)
      .limit(size);

    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);
    // 访客会话没有 user 行：昵称/手机号用访客信息顶上
    const list = rows.map(({ guestMobile, ...r }) => (r.userId
      ? { ...r, guest: false }
      : { ...r, guest: true, nickname: GUEST_NICKNAME, mobile: this.guestMobileLabel(guestMobile), avatar: '' }));
    return { list, total, page, size };
  }

  /** 打开会话：返回资料+消息，同时客服未读清零 */
  async staffGet(convId: number) {
    const conv = await this.convRepo.findOneBy({ id: convId });
    if (!conv) throw new NotFoundException('会话不存在');
    const user = await this.ownerUser(conv);
    const messages = await this.listMessages(conv.id);

    if (conv.staffUnread > 0) {
      conv.staffUnread = 0;
      await this.convRepo.save(conv);
      const summary = this.convSummary(conv, user);
      this.gateway.emitToStaff('support:conversation', { conversation: summary });
    }
    return {
      conversation: this.convSummary(conv, user),
      user: user
        ? { nickname: user.nickname, mobile: user.mobile, avatar: user.avatar }
        : conv.userId
          ? null
          : { nickname: GUEST_NICKNAME, mobile: this.guestMobileLabel(conv.guestMobile), avatar: '' },
      messages,
    };
  }

  /** 客服手动回复 */
  async staffSend(adminId: number, convId: number, type: unknown, content: unknown) {
    const { t, c } = this.validatePayload(type, content);
    const conv = await this.convRepo.findOneBy({ id: convId });
    if (!conv) throw new NotFoundException('会话不存在');

    const msg = await this.msgRepo.save(this.msgRepo.create({
      conversationId: conv.id,
      senderType: SupportSender.STAFF,
      senderAdminId: adminId,
      type: t,
      content: c,
    }));
    conv.lastMessage = t === SupportMsgType.IMAGE ? '[图片]' : c.slice(0, 255);
    conv.lastMessageType = t;
    conv.lastMessageAt = msg.createdAt;
    conv.userUnread += 1;
    // 人工已接手：清掉待回复计时，默认回复复位（下次没人回时可以再发）
    conv.pendingSince = null;
    conv.defaultReplied = false;
    await this.convRepo.save(conv);

    const user = await this.ownerUser(conv);
    const payload = { message: this.msgJson(msg), conversation: this.convSummary(conv, user) };
    this.emitToOwner(conv, 'support:message', payload);
    this.gateway.emitToStaff('support:message', payload);
    return payload;
  }

  // ---- 自动回复规则 CRUD ----

  async listRules() {
    const rows = await this.ruleRepo.find();
    rows.sort((a, b) => b.priority - a.priority || a.id - b.id);
    return rows;
  }

  async createRule(data: { keyword?: string; matchType?: number; reply?: string; priority?: number }) {
    const keyword = String(data.keyword ?? '').trim();
    const reply = String(data.reply ?? '').trim();
    if (!keyword) throw new BadRequestException('关键词不能为空');
    if (keyword.length > 64) throw new BadRequestException('关键词不能超过 64 字');
    if (!reply) throw new BadRequestException('回复内容不能为空');

    const matchType = Number(data.matchType) === SupportMatchType.CONTAINS
      ? SupportMatchType.CONTAINS : SupportMatchType.EXACT;
    return this.ruleRepo.save(this.ruleRepo.create({
      keyword,
      matchType,
      reply: reply.slice(0, 1000),
      priority: Number.isFinite(+data.priority) ? Math.trunc(+data.priority) : 0,
    }));
  }

  async updateRule(
    id: number,
    patch: { keyword?: string; matchType?: number; reply?: string; priority?: number; enabled?: boolean },
  ) {
    const rule = await this.ruleRepo.findOneBy({ id });
    if (!rule) throw new NotFoundException('规则不存在');
    if (patch.keyword !== undefined) {
      const keyword = String(patch.keyword).trim();
      if (!keyword) throw new BadRequestException('关键词不能为空');
      rule.keyword = keyword.slice(0, 64);
    }
    if (patch.matchType !== undefined) {
      rule.matchType = Number(patch.matchType) === SupportMatchType.CONTAINS
        ? SupportMatchType.CONTAINS : SupportMatchType.EXACT;
    }
    if (patch.reply !== undefined) {
      const reply = String(patch.reply).trim();
      if (!reply) throw new BadRequestException('回复内容不能为空');
      rule.reply = reply.slice(0, 1000);
    }
    if (patch.priority !== undefined && Number.isFinite(+patch.priority)) {
      rule.priority = Math.trunc(+patch.priority);
    }
    if (patch.enabled !== undefined) rule.enabled = !!patch.enabled;
    return this.ruleRepo.save(rule);
  }

  async deleteRule(id: number) {
    const rule = await this.ruleRepo.findOneBy({ id });
    if (!rule) throw new NotFoundException('规则不存在');
    await this.ruleRepo.remove(rule);
  }
}
