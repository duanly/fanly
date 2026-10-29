import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConvertLog } from '@/entities';
import { ConvertLogService } from './convert-log.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ConvertLog])],
  providers: [ConvertLogService],
  exports: [ConvertLogService],
})
export class ConvertLogModule {}
