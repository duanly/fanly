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

  // ─── 饿了么 ───

  /** 饿了么活动列表（公开） */
  @Public()
  @Get('ele/activities')
  eleActivities(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.jtk.eleActivities({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  /** 饿了么活动转链（需登录） */
  @Post('ele/convert')
  eleConvert(
    @Body() body: { activityId: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.jtk.eleConvert(body.activityId, userId);
  }

  // ─── 美团券包 ───

  /** 美团券包活动列表（公开） */
  @Public()
  @Get('mt/coupons')
  mtCouponList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.jtk.mtCouponList({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  /** 美团券包转链（需登录） */
  @Post('mt/coupon/convert')
  mtCouponConvert(
    @Body() body: { actId: string },
    @CurrentUser('sub') userId: number,
  ) {
    return this.jtk.mtCouponConvert(body.actId, userId);
  }
}
