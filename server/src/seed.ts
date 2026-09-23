import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminUser, Agent, AgentStatus, User } from './entities';
import { AuthService } from './modules/auth/auth.service';
import { AgentService } from './modules/agent/agent.service';

/** 造一批演示数据：1 个管理员 + 2 个代理 + 4 个用户 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const adminRepo = app.get(getRepositoryToken(AdminUser));
  const agentRepo = app.get(getRepositoryToken(Agent));
  const userRepo = app.get(getRepositoryToken(User));
  const auth = app.get(AuthService);
  const agentSvc = app.get(AgentService);

  if (!(await adminRepo.findOneBy({ username: 'admin' }))) {
    await adminRepo.save(adminRepo.create({
      username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'super',
    }));
    console.log('✓ 管理员 admin / admin123');
  }

  const login = async (mobile: string, invite?: string) => {
    const { devCode } = await auth.sendSms(mobile);
    return auth.login(mobile, devCode, invite);
  };

  // 两个代理
  const codes: string[] = [];
  for (const mobile of ['13800000001', '13800000002']) {
    const r = await login(mobile);
    let a = await agentSvc.findByUser(r.user.id);
    if (!a) a = await agentSvc.apply(r.user.id, `代理${mobile.slice(-1)}`);
    a.status = AgentStatus.ACTIVE;
    if (mobile.endsWith('2')) a.level = 2;
    await agentRepo.save(a);
    codes.push(a.agentCode);
    console.log(`✓ 代理 ${mobile} 推广码 ${a.agentCode} 等级 ${a.level}`);
  }

  // 四个用户，两两挂在两个代理下
  for (let i = 0; i < 4; i++) {
    const mobile = `1390000000${i + 1}`;
    const r = await login(mobile, codes[i % 2]);
    console.log(`✓ 用户 ${mobile} → 代理 ${codes[i % 2]}${r.isNew ? '' : '（已存在）'}`);
  }

  console.log(`\n共 ${await userRepo.count()} 个用户，${await agentRepo.count()} 个代理`);
  console.log('下一步：npm run simulate  —— 模拟下单到提现的完整闭环');
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
