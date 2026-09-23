/**
 * 识别器的样本测试。样本都照着用户真实会粘贴的形态写，
 * 不是干净 URL —— 那种情况本来就不会出问题。
 * 跑：npx ts-node -r tsconfig-paths/register test/share-content.test.ts
 */
import { parseShareContent, explainParseFailure } from '../src/common/share-content';

type Case = { name: string; input: string; platform?: string; kind?: string; token?: string };

const CASES: Case[] = [
  {
    name: '淘口令整段分享文案',
    input: '6.0 复制打开淘宝，【纯棉短袖T恤男士夏季冰丝】¥Ab3XdYeFgHiJk¥ 或长按复制此条信息',
    platform: 'TB', kind: 'password',
  },
  {
    name: '淘宝商品链接带 id',
    input: 'https://item.taobao.com/item.htm?spm=a1z10.3&id=654321987654&ns=1',
    platform: 'TB', kind: 'goodsId', token: '654321987654',
  },
  {
    name: '天猫详情页',
    input: '看看这个 https://detail.tmall.com/item.htm?id=778899001122 挺划算',
    platform: 'TB', kind: 'goodsId', token: '778899001122',
  },
  {
    name: '淘宝短链',
    input: '【淘宝】https://m.tb.cn/h.gAbCdEf 点击链接直接打开',
    platform: 'TB', kind: 'url',
  },
  {
    name: '京东商品链接',
    input: 'https://item.jd.com/100012043978.html',
    platform: 'JD', kind: 'goodsId', token: '100012043978',
  },
  {
    name: '京东短链带文案',
    input: '我发现个好东西 https://u.jd.com/aBcDeF 快来看',
    platform: 'JD', kind: 'url',
  },
  {
    name: '拼多多商品链接',
    input: '【拼多多】我在拼多多发现个好东西 https://mobile.yangkeduo.com/goods.html?goods_id=445566778 快来一起看',
    platform: 'PDD', kind: 'goodsId', token: '445566778',
  },
  {
    name: '抖音短链',
    input: '这个不错 https://v.douyin.com/iABCDe/ 复制打开抖音',
    platform: 'DY', kind: 'url',
  },
  {
    name: '本地 Mock 商品号',
    input: 'MK00000012',
    platform: 'PDD', kind: 'goodsId', token: 'MK00000012',
  },
  {
    name: '链接尾部带中文标点',
    input: '看这个 https://item.jd.com/123456.html，便宜',
    platform: 'JD', kind: 'goodsId', token: '123456',
  },
];

const FAIL_CASES = [
  { name: '空内容', input: '   ' },
  { name: '纯文字没链接', input: '帮我看看这个怎么样' },
  { name: '非电商链接', input: 'https://www.example.com/article/123' },
];

let pass = 0, fail = 0;

console.log('\n=== 应该识别成功的 ===');
for (const c of CASES) {
  const r = parseShareContent(c.input);
  const ok = r
    && (!c.platform || r.platform === c.platform)
    && (!c.kind || r.kind === c.kind)
    && (!c.token || r.token === c.token);
  if (ok) {
    pass++;
    console.log(`  ✅ ${c.name.padEnd(18)} → ${r!.platform} / ${r!.kind} / ${r!.token.slice(0, 40)}`);
  } else {
    fail++;
    console.log(`  ❌ ${c.name}`);
    console.log(`     期望 ${c.platform}/${c.kind}/${c.token ?? '*'}`);
    console.log(`     实际 ${r ? `${r.platform}/${r.kind}/${r.token}` : 'null'}`);
  }
}

console.log('\n=== 应该识别失败并给出提示的 ===');
for (const c of FAIL_CASES) {
  const r = parseShareContent(c.input);
  if (r === null) {
    pass++;
    console.log(`  ✅ ${c.name.padEnd(18)} → ${explainParseFailure(c.input)}`);
  } else {
    fail++;
    console.log(`  ❌ ${c.name} 不该识别出 ${r.platform}/${r.token}`);
  }
}

console.log('\n=== 标题提取 ===');
const t = parseShareContent('6.0 复制打开淘宝，【纯棉短袖T恤男士夏季冰丝】¥Ab3XdYeFgHiJk¥');
console.log(t?.title === '纯棉短袖T恤男士夏季冰丝' ? `  ✅ ${t?.title}` : `  ❌ ${t?.title}`);
t?.title === '纯棉短袖T恤男士夏季冰丝' ? pass++ : fail++;

console.log(`\n通过 ${pass}，失败 ${fail}\n`);
process.exit(fail ? 1 : 0);
