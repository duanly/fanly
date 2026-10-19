import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '@/common/jwt.guard';
import { CurrentUser } from '@/common/decorators';
import { UPLOAD_DIR } from '../admin/upload.controller';

const AVATAR_DIR = resolve(UPLOAD_DIR, 'avatar');

class SmsDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) mobile: string;
}
class LoginDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) mobile: string;
  @Length(4, 6) smsCode: string;
  @IsOptional() @IsString() inviteCode?: string;
  @IsOptional() @IsString() deviceId?: string;
}

class BindInviterDto {
  @IsString() @Length(4, 8) inviteCode: string;
}

class UpdateProfileDto {
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() avatar?: string;
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

  @Post('bind-inviter')
  @ApiOperation({ summary: '绑定邀请人（仅未绑定时可操作）' })
  bindInviter(@CurrentUser('sub') userId: number, @Body() dto: BindInviterDto) {
    return this.auth.bindInviter(userId, dto.inviteCode);
  }

  @Post('profile')
  @ApiOperation({ summary: '更新用户资料（昵称、头像）' })
  updateProfile(@CurrentUser('sub') userId: number, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  @Post('avatar')
  @ApiOperation({ summary: '上传头像' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: AVATAR_DIR,
        filename: (_req, file, cb) => {
          const ts = Date.now();
          const rand = Math.random().toString(36).slice(2, 8);
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${ts}-${rand}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (_req, file, cb) => {
        const ok = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
        cb(ok ? null : new Error('只支持 jpg/png/gif/webp 图片'), ok);
      },
    }),
  )
  uploadAvatar(@CurrentUser('sub') userId: number, @UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/avatar/${file.filename}` };
  }
}
