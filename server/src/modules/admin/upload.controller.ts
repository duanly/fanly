import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { mkdirSync } from 'fs';

// 统一上传目录：优先用 env 的 UPLOAD_DIR，否则用项目根目录下的 uploads
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? resolve(process.env.UPLOAD_DIR)
  : resolve(__dirname, '../../..', 'uploads');

mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(resolve(UPLOAD_DIR, 'avatar'), { recursive: true });

@ApiTags('后台·上传')
@Controller('api/admin')
export class UploadController {
  @Post('upload/image')
  @ApiOperation({ summary: '上传图片，返回 URL 路径' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ts = Date.now();
          const rand = Math.random().toString(36).slice(2, 8);
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${ts}-${rand}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const ok = /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(file.originalname);
        cb(ok ? null : new Error('只支持图片格式'), ok);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/${file.filename}` };
  }
}
