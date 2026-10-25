import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SupportAutoReply, SupportConversation, SupportMatchType, SupportMessage,
  SupportMsgType, SupportSender, User,
} from '@/entities';
import { SysConfigService } from '../admin/sys-config.service';
import { SupportGateway } from './support.gateway';

@Injectable()
export class SupportService {
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
      nickname: user?.nickname ?? '',
      mobile: user?.mobile ?? '',
      avatar: user?.avatar ?? '',
    };
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

  /** 进入客服页：find-or-create；新建时立刻落一条欢迎语，用户打开就看得到问候 */
  async getUserConversation(userId: number) {
    let conv = await this.convRepo.findOneBy({ userId });
    if (!conv) {
      conv = await this.convRepo.save(this.convRepo.create({ userId }));
      const welcome = this.cfg.get('support.welcome', '').trim();
      if (welcome) {
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
    }
    return { conversation: this.convSummary(conv), messages: await this.listMessages(conv.id) };
  }

  /** 用户发消息（文本才触发自动回复，图片只通知人工） */
  async userSend(userId: number, type: unknown, content: unknown) {
    const { t, c } = this.validatePayload(type, content);
    let conv = await this.convRepo.findOneBy({ userId });
    if (!conv) conv = await this.convRepo.save(this.convRepo.create({ userId }));

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
    await this.convRepo.save(conv);

    const user = await this.userRepo.findOneBy({ id: userId });
    const summary = this.convSummary(conv, user);
    this.gateway.emitToStaff('support:message', {
      message: this.msgJson(msg), conversation: summary,
    });

    if (t === SupportMsgType.TEXT && this.cfg.get('support.auto_reply', '1') === '1') {
      await this.runAutoReply(conv, user, c);
    }
    return { message: this.msgJson(msg), conversation: summary };
  }

  /** 规则匹配 → 落自动回复；未命中且有兜底语则用兜底 */
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
    if (!replyText) return;
    await this.deliverAutoReply(conv, user, replyText.slice(0, 1000));
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
    await this.convRepo.save(conv);

    const summary = this.convSummary(conv, user);
    const payload = { message: this.msgJson(msg), conversation: summary };
    this.gateway.emitToUser(conv.userId, 'support:message', payload);
    this.gateway.emitToStaff('support:message', payload);
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
      .addSelect('u.avatar', 'avatar');
    if (opts.keyword) {
      qb.andWhere('(u.mobile LIKE :kw OR u.nickname LIKE :kw)', { kw: `%${opts.keyword}%` });
    }
    qb.orderBy('c.lastMessageAt', 'DESC')
      .offset((page - 1) * size)
      .limit(size);

    const [list, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);
    return { list, total, page, size };
  }

  /** 打开会话：返回资料+消息，同时客服未读清零 */
  async staffGet(convId: number) {
    const conv = await this.convRepo.findOneBy({ id: convId });
    if (!conv) throw new NotFoundException('会话不存在');
    const user = await this.userRepo.findOneBy({ id: conv.userId });
    const messages = await this.listMessages(conv.id);

    if (conv.staffUnread > 0) {
      conv.staffUnread = 0;
      await this.convRepo.save(conv);
      const summary = this.convSummary(conv, user);
      this.gateway.emitToStaff('support:conversation', { conversation: summary });
    }
    return {
      conversation: this.convSummary(conv, user),
      user: user ? { nickname: user.nickname, mobile: user.mobile, avatar: user.avatar } : null,
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
    await this.convRepo.save(conv);

    const user = await this.userRepo.findOneBy({ id: conv.userId });
    const payload = { message: this.msgJson(msg), conversation: this.convSummary(conv, user) };
    this.gateway.emitToUser(conv.userId, 'support:message', payload);
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
