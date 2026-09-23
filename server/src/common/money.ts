/**
 * 钱一律用字符串 + 定点运算，绝不进 float。
 * 内部统一保留 4 位小数，展示时再 toFixed(2)。
 */
const SCALE = 4;

export function toNum(v: string | number): number {
  return typeof v === 'number' ? v : parseFloat(v || '0');
}

export function fix(v: number): string {
  return v.toFixed(SCALE);
}

export function add(a: string | number, b: string | number): string {
  return fix(Math.round((toNum(a) + toNum(b)) * 1e4) / 1e4);
}

export function sub(a: string | number, b: string | number): string {
  return fix(Math.round((toNum(a) - toNum(b)) * 1e4) / 1e4);
}

export function mul(a: string | number, b: string | number): string {
  return fix(Math.round(toNum(a) * toNum(b) * 1e4) / 1e4);
}

export function gte(a: string | number, b: string | number): boolean {
  return toNum(a) >= toNum(b);
}

export function yuan(v: string | number): string {
  return toNum(v).toFixed(2);
}
