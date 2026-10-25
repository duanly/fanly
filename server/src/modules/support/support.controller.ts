import {
  Body, Controller, Get, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, resolve } from 'path';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators';
import { UPLOAD_DIR } from '../admin/upload.controller';
import { SupportService } from './support.service';

const SUPPORT_IMG_DIR = resolve(UPLOAD_DIR, 'support');
if (!existsSync(SUPPORT_IMG_DIR)) mkdirSync(SUPPORT_IMG_DIR, { recursive: true });

@ApiTags('客服')
@Controller('api/support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('conversation')
  @ApiOperation({ summary: '进入客服会话：不存在则创建（带欢迎语）' })
  conversation(@CurrentUser('sub') userId: number) {
    return this.support.getUserConversation(userId);
  }

  @Get('unread')
  @ApiOperation({ summary: '客服未读数（不创建会话）' })
  unread(@CurrentUser('sub') userId: number) {
    return this.support.getUnread(userId);
  }

  @Post('messages')
  @ApiOperation({ summary: '发送消息 {type:1文本/2图片, content}' })
  send(
    @CurrentUser('sub') userId: number,
    @Body() body: { type?: number; content?: string },
  ) {
    return this.support.userSend(userId, body.type, body.content);
  }

  @Post('read')
  @ApiOperation({ summary: '用户侧会话标记已读' })
  read(@CurrentUser('sub') userId: number) {
    return this.support.markUserRead(userId);
  }

  @Post('upload')
  @ApiOperation({ summary: '上传聊天图片，返回 URL' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: SUPPORT_IMG_DIR,
        filename: (_req, file, cb) => {
          const ts = Date.now();
          const rand = Math.random().toString(36).slice(2, 8);
          cb(null, `${ts}-${rand}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const ok = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
        cb(ok ? null : new Error('只支持 jpg/png/gif/webp 图片'), ok);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/support/${file.filename}` };
  }
}
