import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// 启动时确保目录存在（multer 的 diskStorage 不会自动建）
mkdirSync(UPLOAD_DIR, { recursive: true });

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
