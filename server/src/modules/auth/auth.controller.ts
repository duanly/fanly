import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '@/common/jwt.guard';
import { CurrentUser } from '@/common/decorators';

class SmsDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) mobile: string;
}
class LoginDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) mobile: string;
  @Length(4, 6) smsCode: string;
  @IsOptional() @IsString() inviteCode?: string;
  @IsOptional() @IsString() deviceId?: string;
}

@ApiTags('认证')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('sms')
  @ApiOperation({ summary: '发送验证码（开发模式直接返回 devCode）' })
  sms(@Body() dto: SmsDto) { return this.auth.sendSms(dto.mobile); }

  @Public() @Post('login')
  @ApiOperation({ summary: '手机号验证码登录/注册，可带代理邀请码' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.mobile, dto.smsCode, dto.inviteCode, dto.deviceId);
  }

  @Get('profile')
  @ApiOperation({ summary: '当前用户资料' })
  profile(@CurrentUser('sub') userId: number) { return this.auth.profile(userId); }
}
