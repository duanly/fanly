import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as Entities from './entities';

import { JwtGuard } from './common/jwt.guard';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionFilter } from './common/all-exception.filter';

import { CpsModule } from './modules/cps/cps.module';
import { CpsService } from './modules/cps/cps.service';
import { GoodsController } from './modules/cps/goods.controller';
import { OauthController } from './modules/cps/oauth.controller';
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { OrderService } from './modules/order/order.service';
import { OrderController } from './modules/order/order.controller';
import { CommissionService } from './modules/commission/commission.service';
import { FundService } from './modules/fund/fund.service';
import { FundController } from './modules/fund/fund.controller';
import { AgentService } from './modules/agent/agent.service';
import { AgentController } from './modules/agent/agent.controller';
import { SysConfigService } from './modules/admin/sys-config.service';
import { AdminController } from './modules/admin/admin.controller';
import { HealthController } from './modules/admin/health.controller';
import { AuthzService } from './modules/cps/authz.service';
import { AuthzController } from './modules/cps/authz.controller';
import { CompareService } from './modules/cps/compare.service';
import { ComparePublicController, CompareAdminController } from './modules/cps/compare.controller';
import { CartService } from './modules/cart/cart.service';
import { CartController } from './modules/cart/cart.controller';
import { HomeLinkService } from './modules/curation/home.service';
import { RankingService } from './modules/curation/ranking.service';
import { HomeController, HomeAdminController } from './modules/curation/home.controller';
import { CurationService } from './modules/curation/curation.service';
import { CurationController } from './modules/curation/curation.controller';
import { JobService } from './modules/job/job.service';

const ENTITIES = Object.values(Entities).filter((e: any) => typeof e === 'function');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService): TypeOrmModuleOptions => {
        const type = c.get<string>('DB_TYPE', 'sqlite');
        // 生产默认不自动改表；首次部署把 DB_SYNC=true 建完表后立刻改回 false
        const isProd = c.get<string>('NODE_ENV') === 'production';
        const sync = isProd ? c.get<string>('DB_SYNC') === 'true' : true;
        const common = { entities: ENTITIES as any, synchronize: sync, logging: false };
        return type === 'mysql'
          ? {
              type: 'mysql',
              host: c.get<string>('DB_HOST', '127.0.0.1'),
              port: Number(c.get<string>('DB_PORT', '3306')),
              username: c.get<string>('DB_USER', 'root'),
              password: c.get<string>('DB_PASS', ''),
              database: c.get<string>('DB_NAME', 'fanly'),
              charset: 'utf8mb4',
              ...common,
            }
          : {
              type: 'better-sqlite3',
              database: c.get<string>('DB_SQLITE_FILE', './data/fanly.db'),
              ...common,
            };
      },
    }),
    TypeOrmModule.forFeature(ENTITIES as any),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get('JWT_SECRET', 'dev-secret'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    CpsModule,
  ],
  controllers: [
    AuthController, GoodsController, OauthController, OrderController,
    FundController, AgentController, AdminController, HealthController,
    CurationController, AuthzController,
    ComparePublicController, CompareAdminController,
    HomeController, HomeAdminController, CartController,
  ],
  providers: [
    SysConfigService, AuthService, OrderService, CommissionService,
    FundService, AgentService, CurationService, AuthzService, CompareService,
    HomeLinkService, RankingService, CartService, JobService,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionFilter },
  ],
  exports: [SysConfigService, OrderService, CommissionService, FundService, AgentService, AuthService, CurationService],
})
export class AppModule {}
