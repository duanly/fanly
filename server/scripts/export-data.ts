/**
 * 数据导出脚本
 *
 * 用法：
 *   # 导出所有表（数据目录 ./data/export-YYYYMMDD-HHmmss/）
 *   npx ts-node scripts/export-data.ts
 *
 *   # 导出到指定目录
 *   npx ts-node scripts/export-data.ts --out ./data/my-backup
 *
 *   # 只导出指定表
 *   npx ts-node scripts/export-data.ts --tables user,cps_order,topic
 *
 * 从测试服务器导出后，把整个目录拷到正式服务器，用 import-data.ts 导入。
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as entities from '../src/entities';

// ─── 解析命令行参数 ───

function parseArgs(): { outDir?: string; tables?: string[]; help: boolean } {
  const args = process.argv.slice(2);
  const out: any = { help: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out':
      case '-o':
        out.outDir = args[++i];
        break;
      case '--tables':
      case '-t':
        out.tables = args[++i].split(',').map((s: string) => s.trim());
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
    }
  }
  return out;
}

// ─── 主逻辑 ───

async function main() {
  const opts = parseArgs();
  if (opts.help) {
    console.log(`
数据导出脚本

用法:
  npx ts-node scripts/export-data.ts [选项]

选项:
  -o, --out <dir>     导出目录，默认 ./data/export-YYYYMMDD-HHmmss
  -t, --tables <list> 只导出指定表，逗号分隔，如: user,cps_order,topic
  -h, --help          显示帮助
`);
    return;
  }

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
    if (!fs.existsSync(dbFile)) {
      console.error(`❌ 数据库文件不存在: ${dbFile}`);
      process.exit(1);
    }
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
  console.log(`✅ 已连接数据库 (${dbType})`);

  // 要导出的表
  const entityMap: Record<string, any> = {};
  for (const [name, cls] of Object.entries(entities)) {
    if (!cls || typeof cls !== 'function') continue;
    const meta = ds.getRepository(cls).metadata;
    entityMap[meta.tableName] = cls;
  }

  let tableNames = Object.keys(entityMap).sort();
  if (opts.tables?.length) {
    tableNames = tableNames.filter((t) => opts.tables!.includes(t));
    if (!tableNames.length) {
      console.error('❌ 没有匹配的表，可用表名:', Object.keys(entityMap).sort().join(', '));
      await ds.destroy();
      process.exit(1);
    }
  }

  // 输出目录
  const outDir = opts.outDir
    ? path.resolve(opts.outDir)
    : path.resolve(
        `./data/export-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
      );

  if (fs.existsSync(outDir)) {
    console.error(`❌ 输出目录已存在: ${outDir}`);
    await ds.destroy();
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 导出元信息
  const manifest: any = {
    exportedAt: new Date().toISOString(),
    dbType,
    tables: {},
  };

  console.log(`\n📤 开始导出，共 ${tableNames.length} 张表 -> ${outDir}\n`);

  let totalRows = 0;
  for (const tname of tableNames) {
    const cls = entityMap[tname];
    const repo = ds.getRepository(cls);
    const count = await repo.count();
    // 分批读，避免内存爆掉
    const batchSize = 1000;
    const allRows: any[] = [];
    for (let i = 0; i < count; i += batchSize) {
      const rows = await repo.find({ skip: i, take: batchSize });
      allRows.push(...rows);
    }

    const filePath = path.join(outDir, `${tname}.json`);
    fs.writeFileSync(filePath, JSON.stringify(allRows, null, 2));
    const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1);

    manifest.tables[tname] = { count, file: `${tname}.json` };
    totalRows += count;
    console.log(`  ${tname.padEnd(28)} ${String(count).padStart(6)} 行  (${sizeKB} KB)`);
  }

  // 写 manifest
  manifest.totalRows = totalRows;
  fs.writeFileSync(
    path.join(outDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  await ds.destroy();
  console.log(`\n🎉 导出完成！共 ${tableNames.length} 张表，${totalRows} 条数据`);
  console.log(`   目录: ${outDir}`);
  console.log(`   打包: tar czf export.tar.gz ${path.basename(outDir)}`);
}

main().catch((e) => {
  console.error('\n💥 导出失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
