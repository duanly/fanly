import { OnGatewayConnection } from '@nestjs/websockets';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { SupportConversation } from '@/entities';

export const SUPPORT_STAFF_ROOM = 'support:staff';
export const supportUserRoom = (userId: number) => `support:user:${userId}`;
export const supportGuestRoom = (convId: number) => `support:guest:${convId}`;

/**
 * 客服 WebSocket 网关。
 *
 * 消息发送走 REST，落库后由这里推两个事件：
 * - `support:message`：新消息（客服房间收到消息+会话摘要；用户房间收到消息）
 * - `support:conversation`：会话已读等列表变更（客服房间）
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class SupportGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(SupportConversation) private readonly convRepo: Repository<SupportConversation>,
  ) {}

  /**
   * 握手鉴权：token 放在 socket.handshake.auth.token；管理员进客服房间，用户进自己的房间。
   * 未登录访客（忘记密码入口）改传 auth.guestKey，进自己那条访客会话的房间。
   */
  async handleConnection(client: Socket) {
    const guestKey = client.handshake.auth?.guestKey;
    if (guestKey && typeof guestKey === 'string') {
      try {
        const conv = await this.convRepo.findOneBy({ guestKey });
        if (!conv) return client.disconnect(true);
        await client.join(supportGuestRoom(conv.id));
        client.data.guestConvId = conv.id;
      } catch {
        client.disconnect(true);
      }
      return;
    }
    const token = client.handshake.auth?.token;
    if (!token || typeof token !== 'string') return client.disconnect(true);
    try {
      const payload = await this.jwt.verifyAsync(token);
      if (payload.admin === true) {
        await client.join(SUPPORT_STAFF_ROOM);
        client.data.role = 'staff';
      } else if (payload.sub) {
        await client.join(supportUserRoom(payload.sub));
        client.data.userId = payload.sub;
      } else {
        client.disconnect(true);
      }
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(userId: number, event: string, data: unknown) {
    this.server.to(supportUserRoom(userId)).emit(event, data);
  }

  emitToGuest(convId: number, event: string, data: unknown) {
    this.server.to(supportGuestRoom(convId)).emit(event, data);
  }

  emitToStaff(event: string, data: unknown) {
    this.server.to(SUPPORT_STAFF_ROOM).emit(event, data);
  }
}
