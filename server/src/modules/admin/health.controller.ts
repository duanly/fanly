import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '@/common/jwt.guard';

@ApiTags('健康检查')
@Controller('api/health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Public() @Get()
  @ApiOperation({ summary: '容器健康检查，Docker HEALTHCHECK 用' })
  async check() {
    await this.ds.query('SELECT 1');
    return { status: 'ok', db: this.ds.options.type, uptime: Math.floor(process.uptime()) };
  }
}
