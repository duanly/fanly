import { OnGatewayConnection } from '@nestjs/websockets';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

export const SUPPORT_STAFF_ROOM = 'support:staff';
export const supportUserRoom = (userId: number) => `support:user:${userId}`;

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

  constructor(private readonly jwt: JwtService) {}

  /** 握手鉴权：token 放在 socket.handshake.auth.token；管理员进客服房间，用户进自己的房间 */
  async handleConnection(client: Socket) {
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

  emitToStaff(event: string, data: unknown) {
    this.server.to(SUPPORT_STAFF_ROOM).emit(event, data);
  }
}
