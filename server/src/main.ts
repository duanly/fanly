import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

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
  if (showDocs) log.log(`接口文档 http://localhost:${port}/docs`);
}
bootstrap();
