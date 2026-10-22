import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JutuikeService } from './jutuike.service';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/jtk')
@UseGuards(JwtAuthGuard)
export class JutuikeController {
  constructor(private readonly jtk: JutuikeService) {}

  /** 活动列表 */
  @Get('activities')
  activities(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('cateName') cateName?: string,
  ) {
    return this.jtk.activities({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      cateName,
    });
  }

  /** 活动转链 */
  @Post('convert')
  convert(
    @Body() body: { actId: number },
    @CurrentUser('sub') userId: number,
  ) {
    return this.jtk.convert(Number(body.actId), userId);
  }
}
