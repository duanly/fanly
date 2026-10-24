import { BadRequestException, Body, Controller, Get, Logger, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, resolve } from 'path';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { Public } from '@/common/jwt.guard';
import { CurrentUser } from '@/common/decorators';
import { UPLOAD_DIR } from '../admin/upload.controller';

const AVATAR_DIR = resolve(UPLOAD_DIR, 'avatar');

// 启动时确保目录存在（multer 的 diskStorage 不会自动建子目录）
if (!existsSync(AVATAR_DIR)) {
  mkdirSync(AVATAR_DIR, { recursive: true });
}
const logger = new Logger('AvatarUpload');
logger.log(`头像上传目录: ${AVATAR_DIR} (存在=${existsSync(AVATAR_DIR)})`);

class SmsDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) mobile: string;
}

class LoginDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) mobile: string;
  @IsString() @Length(6, 20, { message: '密码长度 6-20 位' }) password: string;
  @IsOptional() @IsString() deviceId?: string;
}

class RegisterDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) mobile: string;
  @IsString() @Length(6, 20, { message: '密码长度 6-20 位' }) password: string;
  @IsString() captchaKey: string;
  @IsString() @Length(4, 6, { message: '图形验证码不正确' }) captchaCode: string;
  @IsOptional() @IsString() inviteCode?: string;
  @IsOptional() @IsString() deviceId?: string;
}

class ChangePasswordDto {
  @IsString() oldPassword: string;
  @IsString() @Length(6, 20, { message: '新密码长度 6-20 位' }) newPassword: string;
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
  constructor(
    private readonly auth: AuthService,
    private readonly captcha: CaptchaService,
  ) {}

  @Public() @Get('captcha')
  @ApiOperation({ summary: '获取图形验证码' })
  getCaptcha() {
    return this.captcha.generate();
  }

  @Public() @Post('sms')
  @ApiOperation({ summary: '发送验证码（开发模式直接返回 devCode）' })
  sms(@Body() dto: SmsDto) { return this.auth.sendSms(dto.mobile); }

  @Public() @Post('register')
  @ApiOperation({ summary: '手机号+密码注册，图形验证码校验' })
  register(@Body() dto: RegisterDto) {
    const ok = this.captcha.verify(dto.captchaKey, dto.captchaCode);
    if (!ok) throw new BadRequestException('图形验证码错误或已过期');
    return this.auth.register(dto.mobile, dto.password, dto.inviteCode, dto.deviceId);
  }

  @Public() @Post('login')
  @ApiOperation({ summary: '手机号密码登录' })
  login(@Body() dto: LoginDto) {
    return this.auth.loginWithPassword(dto.mobile, dto.password, dto.deviceId);
  }

  @Post('password')
  @ApiOperation({ summary: '修改密码（需登录）' })
  changePassword(@CurrentUser('sub') userId: number, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto.oldPassword, dto.newPassword);
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
        destination: (_req, _file, cb) => {
          logger.log(`保存文件到: ${AVATAR_DIR}`);
          cb(null, AVATAR_DIR);
        },
        filename: (_req, file, cb) => {
          const ts = Date.now();
          const rand = Math.random().toString(36).slice(2, 8);
          const ext = extname(file.originalname).toLowerCase();
          const filename = `${ts}-${rand}${ext}`;
          logger.log(`文件: ${file.originalname} (${file.mimetype}, ${file.size} bytes) → ${filename}`);
          cb(null, filename);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (_req, file, cb) => {
        const ok = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
        logger.log(`文件过滤: ${file.originalname} → ${ok ? '通过' : '拒绝'}`);
        cb(ok ? null : new Error('只支持 jpg/png/gif/webp 图片'), ok);
      },
    }),
  )
  uploadAvatar(@CurrentUser('sub') userId: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      logger.error(`上传失败: file 为空, userId=${userId}`);
      throw new Error('上传失败：未收到文件');
    }
    logger.log(`上传成功 userId=${userId}, filename=${file.filename}, size=${file.size}, path=${file.path}`);
    return { url: `/uploads/avatar/${file.filename}` };
  }
}
