import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '@/common/jwt.guard';

/**
 * 各电商开放平台的 OAuth 回调落点。
 *
 * 平台提交应用时要填「授权回调地址」，填的地址必须可访问，
 * 审核和实际授权都会打这里。先把落点做出来，拿到 code 之后
 * 再换 access_token —— 那一步等应用审核通过、拿到凭证再补。
 */
@ApiTags('开放平台授权')
@Controller('api/oauth')
export class OauthController {
  private readonly logger = new Logger(OauthController.name);

  /** 拼多多：https://你的域名/api/oauth/pdd/callback */
  @Public()
  @Get('pdd/callback')
  @ApiOperation({ summary: '拼多多开放平台授权回调' })
  pddCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    this.logger.log(`拼多多授权回调 code=${code ? code.slice(0, 8) + '…' : '(空)'} state=${state || '-'}`);
    // TODO 拿到 client_id/client_secret 后在这里用 code 换 access_token 并落库
    return res.type('html').send(this.page(
      code ? '授权成功' : '回调已收到',
      code ? '你可以关闭本页面返回应用' : '未收到授权码，请从开放平台重新发起授权',
      !!code,
    ));
  }

  /** 京东：https://你的域名/api/oauth/jd/callback */
  @Public()
  @Get('jd/callback')
  @ApiOperation({ summary: '京东联盟授权回调' })
  jdCallback(@Query('code') code: string, @Res() res: Response) {
    this.logger.log(`京东授权回调 code=${code ? code.slice(0, 8) + '…' : '(空)'}`);
    return res.type('html').send(this.page(
      code ? '授权成功' : '回调已收到',
      code ? '你可以关闭本页面返回应用' : '未收到授权码',
      !!code,
    ));
  }

  /** 淘宝：https://你的域名/api/oauth/tb/callback */
  @Public()
  @Get('tb/callback')
  @ApiOperation({ summary: '淘宝联盟授权回调' })
  tbCallback(@Query('code') code: string, @Res() res: Response) {
    this.logger.log(`淘宝授权回调 code=${code ? code.slice(0, 8) + '…' : '(空)'}`);
    return res.type('html').send(this.page(
      code ? '授权成功' : '回调已收到',
      code ? '你可以关闭本页面返回应用' : '未收到授权码',
      !!code,
    ));
  }

  private page(title: string, desc: string, ok: boolean): string {
    return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6f8;
       font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;color:#1a1a1a}
  .c{background:#fff;border-radius:16px;padding:40px 28px;text-align:center;max-width:320px;margin:16px}
  .i{width:64px;height:64px;border-radius:50%;margin:0 auto 18px;display:grid;place-items:center;
     font-size:32px;background:${ok ? '#fff1ef' : '#fff7e6'}}
  h1{font-size:18px;margin:0 0 10px}
  p{font-size:14px;color:#888;line-height:1.7;margin:0}
</style></head>
<body><div class="c">
  <div class="i">${ok ? '✅' : 'ℹ️'}</div>
  <h1>${title}</h1><p>${desc}</p>
</div></body></html>`;
  }
}
