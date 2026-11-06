import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities';
import { AuthService } from './modules/auth/auth.service';

/**
 * 推广专用豹子号批量建号：13111111111 ~ 13999999999（13 + 9 位相同数字，共 9 个）
 *
 * 特性：
 * - 幂等：已存在的手机号直接复用，不重置密码
 * - 走 AuthService.register 正式流程：user + agent(预备代理) + 各平台推广位一次性建好
 * - 结果写到 promo-accounts.json（含密码，勿提交 git），供海报脚本读取
 *
 * 本地：npm run seed:promo
 * 生产：docker compose exec server node dist/seed-promo.js
 *      docker compose cp server:/app/promo-accounts.json ./
 */

// 统一初始密码，建完后可在 App 内自行修改
const PROMO_PASSWORD = 'fanly2026';
const CN_NUM = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];

interface PromoAccount {
  userId: number;
  mobile: string;
  password: string;
  nickname: string;
  inviteCode: string;
  inviteUrl: string;
  reused: boolean;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const userRepo = app.get(getRepositoryToken(User));
  const auth = app.get(AuthService);
  const config = app.get(ConfigService);

  // 海报二维码里的站点地址：生产容器自带 H5_BASE_URL；可用 PROMO_H5_BASE 临时覆盖
  const base = (process.env.PROMO_H5_BASE || config.get('H5_BASE_URL') || 'http://localhost:5173')
    .replace(/\/+$/, '');

  const accounts: PromoAccount[] = [];

  for (let i = 1; i <= 9; i++) {
    const digit = String(i);
    const mobile = `13${digit.repeat(9)}`;
    const nickname = `省钱猫${CN_NUM[i - 1]}号`;

    const existed = await userRepo.findOneBy({ mobile });
    if (existed) {
      accounts.push({
        userId: existed.id,
        mobile,
        password: '(账号已存在，未重置密码)',
        nickname: existed.nickname,
        inviteCode: existed.inviteCode,
        inviteUrl: `${base}/i/${existed.inviteCode}`,
        reused: true,
      });
      console.log(`↺ 已存在，复用 ${mobile} 邀请码 ${existed.inviteCode}`);
      continue;
    }

    // 正式注册流程：user + agent + 推广位 + bcrypt 密码
    const r = await auth.register(mobile, PROMO_PASSWORD);
    // 换个好认的品牌昵称，邀请落地页会展示给扫码人看
    const user = await userRepo.findOneBy({ id: r.user.id });
    user.nickname = nickname;
    await userRepo.save(user);

    accounts.push({
      userId: user.id,
      mobile,
      password: PROMO_PASSWORD,
      nickname,
      inviteCode: user.inviteCode,
      inviteUrl: `${base}/i/${user.inviteCode}`,
      reused: false,
    });
    console.log(`✓ 新建 ${mobile}（${nickname}）邀请码 ${user.inviteCode}`);
  }

  const outFile = resolve(process.cwd(), 'promo-accounts.json');
  writeFileSync(outFile, JSON.stringify(accounts, null, 2));
  console.log(`\n共 ${accounts.length} 个账号（新建 ${accounts.filter((a) => !a.reused).length} 个）`);
  console.log(`明细已写入：${outFile}`);
  console.table(accounts.map(({ mobile, nickname, inviteCode, inviteUrl }) => ({
    mobile, nickname, inviteCode, inviteUrl,
  })));

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
