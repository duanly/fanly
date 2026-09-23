/** 去掉易混淆字符 0/O/1/I 的邀请码字母表 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function genCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

/** 推广位 ID：平台_用户ID_随机，拉单时反解中间段 */
export function genPositionId(platform: string, userId: number): string {
  return `${platform}${userId}X${genCode(4)}`;
}

export function parseUserIdFromPosition(positionId: string): number | null {
  const m = /^[A-Z]+(\d+)X/.exec(positionId || '');
  return m ? parseInt(m[1], 10) : null;
}

export function genOutTradeNo(prefix = 'W'): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1e4).toString().padStart(4, '0')}`;
}
