import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CpsOrder, PromotionPosition, User } from '@/entities';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderClaimService } from './order-claim.service';
import { OrderClaimController, OrderClaimAdminController } from './order-claim.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CpsOrder, PromotionPosition, User])],
  providers: [OrderService, OrderClaimService],
  controllers: [OrderController, OrderClaimController, OrderClaimAdminController],
  exports: [OrderService, OrderClaimService],
})
export class OrderModule {}
