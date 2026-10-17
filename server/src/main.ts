import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getRepositoryToken } from '@nestjs/typeorm';
import { join } from 'path';
import * as express from 'express';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './app.module';
import { AdminUser } from './entities';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // 上传的图片静态资源（公开访问）
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // 启动时确保有一个默认管理员账号（开发环境自动建，生产环境只在没有任何管理员时建）
  const adminRepo = app.get(getRepositoryToken(AdminUser));
  const adminCount = await adminRepo.count();
  if (adminCount === 0) {
    await adminRepo.save(adminRepo.create({
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'super',
    }));
    new Logger('Bootstrap').warn('⚠️  未检测到管理员账号，已创建默认账号 admin / admin123，请尽快修改密码！');
  }

  // 生产默认不暴露接口文档，需要时 ENABLE_DOCS=true
  const showDocs = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS === 'true';
  if (showDocs) {
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('返利导购平台 API')
      .setDescription('CPS 返利 / 代理分成 / 资金结算')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, doc);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  const log = new Logger('Bootstrap');
  log.log(`服务已启动 :${port}  环境 ${process.env.NODE_ENV || 'development'}`);
  if (process.env.SKIP_SMS_VERIFY === 'true') {
    log.warn('='.repeat(60));
    log.warn('⚠️  SKIP_SMS_VERIFY=true：任何人输任意手机号都能登录');
    log.warn('⚠️  仅供测试，正式运营前必须在 .env 里改回 false');
    log.warn('='.repeat(60));
  }
  if (showDocs) log.log(`接口文档 http://localhost:${port}/docs`);
}
bootstrap();
