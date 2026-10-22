import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionPosition, User } from '@/entities';
import { JutuikeService } from './jutuike.service';
import { JutuikeController } from './jutuike.controller';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromotionPosition, User]),
    OrderModule,
  ],
  providers: [JutuikeService],
  controllers: [JutuikeController],
  exports: [JutuikeService],
})
export class JutuikeModule {}
