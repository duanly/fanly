import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * 通用管理员守卫：只接受 /api/admin/login 签发的 JWT（payload.admin === true）。
 * 全局 JwtGuard 只验证 token 有效性、不区分身份；所有后台写操作都应叠加本守卫。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.admin !== true) throw new UnauthorizedException('需要管理员权限');
    return true;
  }
}
