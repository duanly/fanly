import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurationService } from './curation.service';
import { CpsService } from '../cps/cps.service';

/**
 * 后台选品。走全局 JwtGuard，只有登录后台才进得来。
 *
 * 典型用法：先 /search 找商品 → 看中的 /add 进池 → /list 里调权重分专题。
 */
@ApiTags('后台·选品')
@Controller('api/admin/curation')
export class CurationController {
  constructor(
    private readonly curation: CurationService,
    private readonly cps: CpsService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: '搜商品（按到手返利排序），用于挑选加入池子' })
  async search(
    @Query('platform') platform = 'PDD',
    @Query('keyword') keyword?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '30',
    @Query('sort') sort = 'rebate',
  ) {
    // 全平台搜是比价组的前提——要把同款从各家找出来才能放进一组
    if ((platform || '').toUpperCase() === 'ALL') {
      const list = await this.cps.searchAll({ keyword, pageSize: +pageSize, sort });
      return { list, total: list.length, page: +page, hasMore: false };
    }
    // rebate 是「全量拉回来按佣金排前 N」，没有翻页概念；其余排序走真分页
    if (sort === 'rebate') {
      const list = await this.cps.searchByRebate(platform, { keyword, pageSize: +pageSize });
      return { list, total: list.length, page: +page, hasMore: false };
    }
    return this.cps.searchGoodsPage(platform, { keyword, page: +page, pageSize: +pageSize, sort });
  }

  @Get('recommend')
  @ApiOperation({ summary: '看平台榜单，懒得想关键词时从这儿挑' })
  recommend(
    @Query('platform') platform = 'PDD',
    @Query('channel') channel = 'earn',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '30',
  ) {
    return this.cps.recommendGoodsPage(platform, { channel, page: +page, pageSize: +pageSize });
  }

  @Get('list')
  @ApiOperation({ summary: '池内列表，含已下架的' })
  list(
    @Query('groupKey') groupKey?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.curation.list({
      groupKey: groupKey || undefined,
      status: status === undefined || status === '' ? undefined : +status,
      page: +page,
      pageSize: +pageSize,
    });
  }

  @Get('groups')
  @ApiOperation({ summary: '专题列表及在架数' })
  groups() {
    return this.curation.groups();
  }

  @Post('add')
  @ApiOperation({ summary: '加入待上架队列，已存在则刷新快照' })
  add(@Body() body: { platform: string; goodsId: string; groupKey?: string; sortWeight?: number }) {
    return this.curation.add(
      body.platform || 'PDD',
      body.goodsId,
      body.groupKey || 'default',
      body.sortWeight ?? 0,
    );
  }

  @Post('import')
  @ApiOperation({ summary: '一键批量导入：拉取有佣金的商品进入待上架队列' })
  importBatch(
    @Body() body: {
      platform?: string; channel?: string; keyword?: string;
      count?: number; groupKey?: string; sortWeight?: number;
    },
  ) {
    return this.curation.importBatch(body);
  }

  @Post('auto-pull')
  @ApiOperation({ summary: '手动触发自动拉品（进待选品池），商品多时会跑一会儿' })
  autoPull(@Body() body: { platforms?: string[]; targetPerPlatform?: number; keywords?: string[] }) {
    return this.curation.autoPull(body || {});
  }

  @Post('batch-on-shelf')
  @ApiOperation({ summary: '批量上架：把待选品或下架的商品设为上架' })
  async batchOnShelf(@Body() body: { ids: number[] }) {
    const ids = body.ids || [];
    let updated = 0;
    for (const id of ids) {
      try {
        await this.curation.update(id, { status: 1 });
        updated++;
      } catch { /* 单个失败不影响整体 */ }
    }
    return { updated, total: ids.length };
  }

  @Post('batch-remove')
  @ApiOperation({ summary: '批量删除商品（连带清掉专题关联）' })
  async batchRemove(@Body() body: { ids: number[] }) {
    const ids = body.ids || [];
    let deleted = 0;
    for (const id of ids) {
      try {
        const r = await this.curation.remove(id);
        deleted += r.deleted || 0;
      } catch { /* 单个失败不影响整体 */ }
    }
    return { deleted, total: ids.length };
  }

  @Post('exists-batch')
  @ApiOperation({ summary: '批量查询商品是否已在货架（返回 status map）' })
  existsBatch(@Body() body: { items: Array<{ platform: string; goodsId: string }> }) {
    return this.curation.existsBatch(body.items || []);
  }

  // 静态路由必须排在 @Post(':id') 前面，否则 /refresh-all 会被当成 id
  @Post('refresh-all')
  @ApiOperation({ summary: '全池刷新，商品多时会跑一会儿' })
  refreshAll() {
    return this.curation.refreshAll();
  }

  @Post('remove-off-shelf')
  @ApiOperation({ summary: '一键移除所有已下架商品（人工下架 + 自动下架）' })
  removeOffShelf() {
    return this.curation.removeOffShelf();
  }

  @Post(':id')
  @ApiOperation({ summary: '改专题 / 权重 / 上下架' })
  update(
    @Param('id') id: string,
    @Body() body: { groupKey?: string; sortWeight?: number; status?: number },
  ) {
    return this.curation.update(+id, body);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: '手动刷这一件的价格和佣金' })
  refresh(@Param('id') id: string) {
    return this.curation.refreshById(+id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '从池子里移除' })
  remove(@Param('id') id: string) {
    return this.curation.remove(+id);
  }
}
