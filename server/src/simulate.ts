import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { Agent, CpsOrder, FundLedger, PromotionPosition, User } from './entities';
import { CpsService } from './modules/cps/cps.service';
import { OrderService } from './modules/order/order.service';
import { FundService } from './modules/fund/fund.service';
import { SysConfigService } from './modules/admin/sys-config.service';
import { yuan } from './common/money';

/**
 * 全链路验收脚本：下单 → 收货 → 结算 → 分佣入账 → 提现 → 退款回滚。
 * 这一步跑通，说明返利平台的核心闭环是对的。
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const cps = app.get(CpsService);
  const orderSvc = app.get(OrderService);
  const fund = app.get(FundService);
  const cfg = app.get(SysConfigService);
  const userRepo = app.get(getRepositoryToken(User));
  const agentRepo = app.get(getRepositoryToken(Agent));
  const posRepo = app.get(getRepositoryToken(PromotionPosition));
  const orderRepo = app.get(getRepositoryToken(CpsOrder));
  const ledgerRepo = app.get(getRepositoryToken(FundLedger));

  const user = await userRepo.findOne({ where: { mobile: '13900000001' } });
  if (!user) { console.error('请先跑 npm run seed'); process.exit(1); }
  const agent = await agentRepo.findOneBy({ id: user.agentId });
  const agentUser = await userRepo.findOneBy({ id: agent.userId });
  const pos = await posRepo.findOneBy({ userId: user.id, platform: 'PDD' });

  const line = (s = '') => console.log(s);
  const show = async (tag: string) => {
    const u = await userRepo.findOneBy({ id: user.id });
    const a = await userRepo.findOneBy({ id: agentUser.id });
    line(`  ${tag}`);
    line(`    用户余额 ${yuan(u.balance)}  预估 ${yuan(u.pending)}  冻结 ${yuan(u.frozen)}`);
    line(`    代理余额 ${yuan(a.balance)}`);
  };

  line('\n========== 返利闭环验收 ==========');
  line(`用户 ${user.mobile} (id=${user.id})  上级代理 ${agent.agentCode} (等级 ${agent.level})`);
  line(`分佣配置：用户 ${cfg.num('rebate.user_rate') * 100}% / 代理 ${cfg.num(`rebate.agent_rate.${agent.level}`) * 100}%`);

  const mock = cps.getMock('PDD');
  const goods = (await cps.searchGoods('PDD', { pageSize: 1 }))[0];
  const qty = Math.ceil(60 / (goods.couponPrice * goods.commissionRate));  // 凑够能提现的佣金
  const payAmount = Math.round(goods.couponPrice * qty * 100) / 100;
  const est = Math.round(payAmount * goods.commissionRate * 100) / 100;
  const orderNo = `SIM${Date.now()}`;
  line(`\n[1] 用户下单：${goods.title} × ${qty}`);
  line(`    实付 ${payAmount} 元，佣金率 ${(goods.commissionRate * 100).toFixed(2)}%，平台预估佣金 ${est} 元`);

  const base = {
    platform: 'PDD', platformOrderNo: orderNo, subOrderNo: '',
    positionId: pos.positionId, goodsId: goods.goodsId, goodsTitle: goods.title,
    goodsImg: goods.image, payAmount, commissionRate: goods.commissionRate,
    estCommission: est, settleCommission: 0, orderTime: new Date(),
  };

  await orderSvc.upsert({ ...base, status: 1 });
  await show('[2] 订单已付款 → 预估返利挂到 pending，不可提现');

  await orderSvc.upsert({ ...base, status: 2 });
  await show('[3] 已收货 → 仍是预估，等联盟结算');

  const settle = est;  // 联盟实际结算给平台的金额
  await orderSvc.upsert({ ...base, status: 3, settleCommission: settle, settleTime: new Date() });
  await show(`[4] 联盟已结算 ${settle} 元 → 分佣入账`);

  const details = await app.get(getRepositoryToken(CpsOrder)).manager.query(
    `SELECT beneficiaryType, amount, rate FROM commission_detail WHERE orderId = (SELECT id FROM cps_order WHERE platformOrderNo='${orderNo}')`,
  );
  line('    分佣明细：');
  for (const d of details) {
    const name = ['', '用户返利', '代理分成', '平台利润'][d.beneficiaryType];
    line(`      ${name}  ${yuan(d.amount)} 元  (比例 ${(d.rate * 100).toFixed(2)}%)`);
  }

  line('\n[5] 用户提现 10 元');
  try {
    const wd = await fund.applyWithdraw(user.id, 10, 'WECHAT', 'demo-openid');
    await show(`    提现单 #${wd.id} 已提交，金额进冻结`);
    await fund.auditWithdraw(wd.id, true, 1);
    line('    后台审核通过 → 进入打款队列');
    await fund.finishWithdraw(wd.id, true, 'CH123456');
    await show('    打款成功，冻结核销');
  } catch (e) {
    line(`    提现失败：${e.message}`);
  }

  line('\n[6] 模拟买家退款 → 订单失效，分佣冲销');
  await orderSvc.upsert({ ...base, status: 4, settleCommission: settle });
  await show('    冲销完成（余额可为负，下次返利先抵扣）');

  const dump = async (uid: number, tag: string) => {
    const ls = await ledgerRepo.find({ where: { userId: uid }, order: { id: 'ASC' } });
    line(`\n[7] ${tag}资金流水：`);
    for (const l of ls) {
      line(`    #${l.id} ${l.bizType.padEnd(16)} ${yuan(l.amount).padStart(9)}  余额 ${yuan(l.balanceAfter).padStart(9)}  ${l.remark}`);
    }
  };
  await dump(user.id, '用户');
  await dump(agentUser.id, '代理');

  const diff = await fund.reconcile();
  line(`\n[8] 对账：${diff.length ? '❌ 不一致 ' + JSON.stringify(diff) : '✅ 流水重放与余额一致'}`);
  line(`\n订单总数 ${await orderRepo.count()}`);
  line('========== 闭环验收结束 ==========\n');
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
