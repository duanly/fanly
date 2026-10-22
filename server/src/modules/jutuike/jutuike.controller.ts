import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { JutuikeService } from './jutuike.service';
import { CurrentUser } from '@/common/decorators';
import { Public } from '@/common/jwt.guard';

@Controller('api/jtk')
export class JutuikeController {
  constructor(private readonly jtk: JutuikeService) {}

  /** 活动列表（公开，未登录也能浏览） */
  @Public()
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

  /** 活动转链（需登录，生成带用户标识的推广链接） */
  @Post('convert')
  convert(
    @Body() body: { actId: number },
    @CurrentUser('sub') userId: number,
  ) {
    return this.jtk.convert(Number(body.actId), userId);
  }
}
