import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload { sub: number; mobile: string; agentId?: number }

export const CurrentUser = createParamDecorator(
  (key: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const user: JwtPayload = ctx.switchToHttp().getRequest().user;
    return key ? user?.[key] : user;
  },
);
