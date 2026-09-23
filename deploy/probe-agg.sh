#!/usr/bin/env bash
# 订单侠接口探测：把真实返回打出来，用于确认字段映射。
#
# 在服务器上跑（容器代理可能拦外部域名，所以直接在宿主机跑）：
#   chmod +x deploy/probe-agg.sh
#   AGG_API_KEY=你的key ./deploy/probe-agg.sh 2>&1 | tee /tmp/agg-probe.log
#
# 只读接口，不会产生订单，也不花钱（转链/解析按次计费，每次几厘）。

set -uo pipefail
KEY="${AGG_API_KEY:-}"
BASE="${AGG_BASE_URL:-https://api.tbk.dingdanxia.com}"

if [ -z "$KEY" ]; then
  echo "❌ 先设 AGG_API_KEY=你的key"
  exit 1
fi

# 有 python3 就美化输出并截断，没有就原样打
pretty() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw[:1200]); sys.exit()

def trim(o, depth=0):
    if isinstance(o, list):
        return [trim(x, depth+1) for x in o[:2]]   # 列表只留前两条
    if isinstance(o, dict):
        return {k: trim(v, depth+1) for k, v in o.items()}
    if isinstance(o, str) and len(o) > 160:
        return o[:160] + "…"
    return o

print(json.dumps(trim(d), ensure_ascii=False, indent=2)[:3000])
'
  else
    head -c 1500
  fi
}

hit() {
  local name="$1" method="$2" path="$3"; shift 3
  echo ""
  echo "════════════════════════════════════════════════"
  echo "▶ $name"
  echo "  $method $BASE$path"
  echo "────────────────────────────────────────────────"
  if [ "$method" = "GET" ]; then
    local qs=""
    for kv in "$@"; do qs="$qs&$kv"; done
    curl -sS -m 30 "$BASE$path?apikey=$KEY$qs" | pretty
  else
    local args=(-d "apikey=$KEY")
    for kv in "$@"; do args+=(-d "$kv"); done
    curl -sS -m 30 -X POST "$BASE$path" "${args[@]}" | pretty
  fi
}

echo "探测目标：$BASE"
echo "key 尾四位：...${KEY: -4}"

# ── 1. 官方商品库（榜单选品）──────────────────────
# material_id：3756=好券直播 27446=大额券 28026=高佣榜（各家定义可能不同）
hit "商品库 · 好券直播" GET  "/spk/optimus" "material_id=3756" "page_size=2" "page_no=1"

# ── 2. 淘口令解析 ────────────────────────────────
hit "淘口令解析" POST "/tkl/query" "tkl=¥CxYz1AbCdEf¥"

# ── 3. 订单查询 ──────────────────────────────────
S=$(date -d '-2 hour' +'%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-2H +'%Y-%m-%d %H:%M:%S')
E=$(date +'%Y-%m-%d %H:%M:%S')
hit "订单查询（近2小时）" POST "/tbk/order_details" "start_time=$S" "end_time=$E" "query_type=1" "page_size=2"

# ── 4. 转链：文档页打不开，挨个候选试，哪个不报 404 就是它 ──
for p in /tbk/privilege_link /tbk/privilege /tbk/high_commission /tbk/universal_convert /tbk/tkl_privilege; do
  hit "转链候选 $p" POST "$p" "num_iid=520813250866"
done

echo ""
echo "════════════════════════════════════════════════"
echo "跑完了。把上面整段输出贴回对话，我照着做字段映射。"
echo "注意：输出里不含 apikey，可以放心贴。"
