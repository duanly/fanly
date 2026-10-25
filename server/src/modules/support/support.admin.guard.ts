import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * 客服模块专用守卫：只接受管理员 JWT（登录 /api/admin/login 签发的 payload.admin=true）。
 * 现有全局 JwtGuard 只验证 token 有效性、不区分身份，这里补上角色判断。
 */
@Injectable()
export class SupportAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.admin !== true) throw new UnauthorizedException('需要客服权限');
    return true;
  }
}
