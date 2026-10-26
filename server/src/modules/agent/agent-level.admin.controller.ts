import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '@/common/admin.guard';
import { CurrentUser } from '@/common/decorators';
import { AgentService } from './agent.service';

@ApiTags('代理等级审核')
@UseGuards(AdminGuard)
@Controller('api/admin/agent-levels')
export class AgentLevelAdminController {
  constructor(private readonly agent: AgentService) {}

  @Get()
  @ApiOperation({ summary: '升降级审核列表：status 0待审/1通过/2驳回/3取消；type 1升级/2降级' })
  list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('size') size = '20',
  ) {
    return this.agent.adminLevelList({
      status: status === undefined ? undefined : +status,
      type: type === undefined ? undefined : +type,
      page: +page,
      size: +size,
    });
  }

  @Post(':id/audit')
  @ApiOperation({ summary: '审核：pass true通过 false驳回（reason 驳回原因）' })
  audit(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: string,
    @Body() body: { pass?: boolean; reason?: string },
  ) {
    return this.agent.auditLevel(adminId, +id, !!body.pass, body.reason || '');
  }
}
