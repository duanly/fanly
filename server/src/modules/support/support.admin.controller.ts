import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators';
import { AdminGuard } from '@/common/admin.guard';
import { SupportService } from './support.service';

@ApiTags('客服工作台')
@UseGuards(AdminGuard)
@Controller('api/admin/support')
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get('conversations')
  @ApiOperation({ summary: '会话列表（含用户资料），keyword 搜手机号/昵称' })
  list(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.support.staffList({
      keyword: keyword?.trim() || undefined,
      page: page ? +page : 1,
      size: size ? +size : 20,
    });
  }

  @Get('unread-total')
  @ApiOperation({ summary: '客服未读总条数（入口角标）' })
  unreadTotal() { return this.support.staffUnreadTotal(); }

  @Get('conversations/:id')
  @ApiOperation({ summary: '会话详情（打开即客服已读）' })
  detail(@Param('id') id: string) {
    return this.support.staffGet(+id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: '客服发送消息' })
  send(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: string,
    @Body() body: { type?: number; content?: string },
  ) {
    return this.support.staffSend(adminId, +id, body.type, body.content);
  }

  // ---- 自动回复规则 ----

  @Get('rules')
  @ApiOperation({ summary: '自动回复规则列表' })
  rules() { return this.support.listRules(); }

  @Post('rules')
  @ApiOperation({ summary: '新增自动回复规则' })
  createRule(@Body() body: { keyword?: string; matchType?: number; reply?: string; priority?: number }) {
    return this.support.createRule(body);
  }

  @Put('rules/:id')
  @ApiOperation({ summary: '修改自动回复规则' })
  updateRule(
    @Param('id') id: string,
    @Body() body: { keyword?: string; matchType?: number; reply?: string; priority?: number; enabled?: boolean },
  ) {
    return this.support.updateRule(+id, body);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: '删除自动回复规则' })
  deleteRule(@Param('id') id: string) {
    return this.support.deleteRule(+id);
  }
}
