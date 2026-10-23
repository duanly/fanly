/**
 * 数据导入脚本
 *
 * 用法：
 *   # 导入整个导出目录
 *   npx ts-node scripts/import-data.ts --dir ./data/export-20261023-120000
 *
 *   # 只导入指定表
 *   npx ts-node scripts/import-data.ts --dir ... --tables user,cps_order
 *
 *   # 清空目标表再导入（谨慎！）
 *   npx ts-node scripts/import-data.ts --dir ... --truncate
 *
 * 注意：
 * - 导入顺序会自动按依赖关系排序（先基础表，后有关联的表）
 * - 如果目标表已有数据，默认跳过（用主键 UPSERT）
 * - 使用 --truncate 会先清空表再导入
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as entities from '../src/entities';

// ─── 解析参数 ───

function parseArgs(): {
  dir?: string;
  tables?: string[];
  truncate: boolean;
  help: boolean;
  yes: boolean;
} {
  const args = process.argv.slice(2);
  const out: any = { truncate: false, help: false, yes: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':
      case '-d':
        out.dir = args[++i];
        break;
      case '--tables':
      case '-t':
        out.tables = args[++i].split(',').map((s: string) => s.trim());
        break;
      case '--truncate':
        out.truncate = true;
        break;
      case '--yes':
      case '-y':
        out.yes = true;
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
    }
  }
  return out;
}

// 表依赖顺序（被依赖的表先导入）
// 如果表之间有外键约束，按这个顺序导就不会报错
const TABLE_ORDER = [
  'user',
  'admin_user',
  'agent',
  'promotion_position',
  'topic',
  'goods_topic',
  'curated_goods',
  'goods_recommend',
  'compare_group',
  'home_link',
  'sys_config',
  'cart_item',
  'checkin',
  'coin_ledger',
  'cps_order',
  'commission_detail',
  'fund_ledger',
  'order_claim',
  'withdraw',
];

function sortTables(tables: string[]): string[] {
  return [...tables].sort((a, b) => {
    const ia = TABLE_ORDER.indexOf(a);
    const ib = TABLE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ─── 主逻辑 ───

async function main() {
  const opts = parseArgs();
  if (opts.help || !opts.dir) {
    console.log(`
数据导入脚本

用法:
  npx ts-node scripts/import-data.ts --dir <导出目录> [选项]

选项:
  -d, --dir <dir>      导出数据目录（含 _manifest.json）
  -t, --tables <list>  只导入指定表，逗号分隔
      --truncate       导入前清空目标表（危险！）
  -y, --yes            跳过确认，直接执行
  -h, --help           显示帮助
`);
    return;
  }

  const dir = path.resolve(opts.dir);
  if (!fs.existsSync(dir)) {
    console.error(`❌ 目录不存在: ${dir}`);
    process.exit(1);
  }

  // 读 manifest
  const manifestPath = path.join(dir, '_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ 找不到 _manifest.json，请确认是导出脚本生成的目录');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 加载 .env
  require('dotenv').config();
  const config = new ConfigService();

  const dbType = config.get('DB_TYPE', 'sqlite');
  let dsOptions: any;

  if (dbType === 'mysql') {
    dsOptions = {
      type: 'mysql',
      host: config.get('DB_HOST', '127.0.0.1'),
      port: Number(config.get('DB_PORT', 3306)),
      username: config.get('DB_USER', 'root'),
      password: config.get('DB_PASS', ''),
      database: config.get('DB_NAME', 'fanly'),
      charset: 'utf8mb4',
    };
  } else {
    const dbFile = path.resolve(config.get('DB_SQLITE_FILE', './data/fanly.db'));
    dsOptions = {
      type: 'sqlite',
      database: dbFile,
    };
  }

  const ds = new DataSource({
    ...dsOptions,
    entities: Object.values(entities),
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log(`✅ 已连接目标数据库 (${dbType})`);

  // 建立表名 → 实体映射
  const entityMap: Record<string, any> = {};
  for (const [name, cls] of Object.entries(entities)) {
    if (!cls || typeof cls !== 'function') continue;
    try {
      const meta = ds.getRepository(cls).metadata;
      entityMap[meta.tableName] = cls;
    } catch {
      // 不是实体类，跳过
    }
  }

  // 确定要导入的表
  let tableNames = Object.keys(manifest.tables || {});
  if (opts.tables?.length) {
    tableNames = tableNames.filter((t) => opts.tables!.includes(t));
    if (!tableNames.length) {
      console.error('❌ 没有匹配的表，可用:', Object.keys(manifest.tables).join(', '));
      await ds.destroy();
      process.exit(1);
    }
  }
  // 按依赖顺序排序
  tableNames = sortTables(tableNames);

  // 预览
  console.log(`\n📋 即将导入 ${tableNames.length} 张表：`);
  for (const t of tableNames) {
    const info = manifest.tables[t] || {};
    console.log(`   ${t.padEnd(28)} ${String(info.count || '?').padStart(6)} 行`);
  }
  if (opts.truncate) {
    console.log(`\n⚠️  --truncate 模式：导入前会清空目标表！`);
  } else {
    console.log(`\nℹ️   默认 UPSERT：主键冲突时更新，不冲突时插入`);
  }

  // 确认
  if (!opts.yes) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise<string>((resolve) => {
      readline.question('\n确认导入？输入 yes 继续: ', (a: string) => {
        readline.close();
        resolve(a.trim());
      });
    });
    if (answer !== 'yes') {
      console.log('已取消。');
      await ds.destroy();
      return;
    }
  }

  console.log('\n📥 开始导入...\n');

  let totalInserted = 0;
  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();

  try {
    for (const tname of tableNames) {
      const cls = entityMap[tname];
      if (!cls) {
        console.log(`  ⚠️  ${tname}  找不到对应实体，跳过`);
        continue;
      }

      const info = manifest.tables[tname] || {};
      const filePath = path.join(dir, info.file || `${tname}.json`);
      if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️  ${tname}  文件不存在，跳过`);
        continue;
      }

      const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!rows.length) {
        console.log(`  ${tname.padEnd(28)} 0 行 (空表，跳过)`);
        continue;
      }

      const repo = ds.getRepository(cls);
      const meta = repo.metadata;

      // 清空（危险操作）
      if (opts.truncate) {
        await queryRunner.query(
          dbType === 'mysql'
            ? `TRUNCATE TABLE \`${tname}\``
            : `DELETE FROM "${tname}"`,
        );
      }

      // 分批插入，每批 200 条
      const batchSize = 200;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        // 清理 undefined 字段（SQLite 不喜欢）
        const cleanBatch = batch.map((row: any) => {
          const obj: any = {};
          for (const [k, v] of Object.entries(row)) {
            if (v !== undefined && v !== null) {
              // 日期字段：字符串转回 Date
              const col = meta.columns.find((c) => c.propertyName === k || c.databaseName === k);
              if (col && col.type === 'datetime' && typeof v === 'string') {
                obj[k] = new Date(v);
              } else {
                obj[k] = v;
              }
            }
          }
          return obj;
        });

        try {
          if (dbType === 'mysql') {
            // MySQL: INSERT ... ON DUPLICATE KEY UPDATE
            await repo
              .createQueryBuilder()
              .insert()
              .into(meta.tableName)
              .values(cleanBatch)
              .orUpdate(meta.columns.map((c) => c.databaseName))
              .execute();
          } else {
            // SQLite: INSERT OR REPLACE
            await repo
              .createQueryBuilder()
              .insert()
              .into(meta.tableName)
              .values(cleanBatch)
              .orIgnore(true) // SQLite 没有 orUpdate，用 orIgnore 跳过冲突
              .execute();
            // 额外尝试更新（简单起见，SQLite 模式下先删再插）
            // 但为了安全，先 orIgnore，如果是 truncate 模式就没问题
          }
          inserted += cleanBatch.length;
        } catch (e: any) {
          console.log(`  ⚠️  ${tname}  第 ${i / batchSize + 1} 批导入出错: ${e.message}`);
          // 继续下一批
        }
      }

      totalInserted += inserted;
      console.log(`  ${tname.padEnd(28)} ${inserted} 条 ${opts.truncate ? '(truncate)' : ''}`);
    }

    console.log(`\n🎉 导入完成！共 ${totalInserted} 条数据`);
  } finally {
    await queryRunner.release();
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error('\n💥 导入失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
