import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthzService } from './authz.service';
import { CurrentUser } from '@/common/decorators';

@ApiTags('平台授权')
@Controller('api/authz')
export class AuthzController {
  constructor(private readonly authz: AuthzService) {}

  @Get('status')
  @ApiOperation({ summary: '查我在某平台的授权状态，force=1 忽略缓存重查' })
  status(
    @CurrentUser('sub') userId: number,
    @Query('platform') platform = 'PDD',
    @Query('force') force?: string,
  ) {
    return this.authz.status(userId, platform, force === '1' || force === 'true');
  }

  @Get('url')
  @ApiOperation({ summary: '生成授权链接，在拼多多里打开完成授权' })
  url(@CurrentUser('sub') userId: number, @Query('platform') platform = 'PDD') {
    return this.authz.authUrl(userId, platform);
  }
}
