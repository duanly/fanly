import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionPosition, User } from '@/entities';
import { JutuikeService } from './jutuike.service';
import { JutuikeController } from './jutuike.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromotionPosition, User]),
  ],
  providers: [JutuikeService],
  controllers: [JutuikeController],
  exports: [JutuikeService],
})
export class JutuikeModule {}
