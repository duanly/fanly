import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderClaimService } from './order-claim.service';
import { CurrentUser } from '@/common/decorators';

@ApiTags('订单找回')
@Controller('api/claim')
export class OrderClaimController {
  constructor(private readonly claim: OrderClaimService) {}

  @Post()
  @ApiOperation({ summary: '提交找回申请，能当场匹配的立刻归属' })
  apply(@CurrentUser('sub') userId: number, @Body() body: any) {
    return this.claim.apply(userId, body);
  }

  @Get()
  @ApiOperation({ summary: '我的找回记录' })
  list(
    @CurrentUser('sub') userId: number,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.claim.listByUser(userId, +page, +pageSize);
  }
}

@ApiTags('后台·订单找回')
@Controller('api/admin/claim')
export class OrderClaimAdminController {
  constructor(private readonly claim: OrderClaimService) {}

  @Get()
  @ApiOperation({ summary: '找回申请列表，待处理的排前面' })
  list(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.claim.adminList(
      status === undefined || status === '' ? undefined : +status,
      +page, +pageSize,
    );
  }

  @Post(':id/audit')
  @ApiOperation({ summary: '人工裁决；通过时会再匹配一次订单' })
  audit(
    @Param('id') id: string,
    @Body() body: { pass: boolean; reason?: string },
    @CurrentUser('sub') adminId: number,
  ) {
    return this.claim.audit(+id, body?.pass, adminId, body?.reason);
  }

  @Post('retry')
  @ApiOperation({ summary: '手动催一次重试' })
  retry() { return this.claim.retryPending(); }
}
