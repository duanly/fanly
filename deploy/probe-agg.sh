#!/usr/bin/env bash
# 订单侠接口探测：确认接口地址、参数名和字段结构。
#
# 用法（在服务器宿主机上跑，容器和本机代理可能拦外部域名）：
#   chmod +x deploy/probe-agg.sh
#   AGG_API_KEY=你的key ADZONE_ID=3187197202 ./deploy/probe-agg.sh 2>&1 | tee /tmp/agg-probe.log
#
# 可选：
#   PID='mm_123_456_3187197202'   完整 PID，有就一起试
#   PROBE_TKL='6.0 复制打开淘宝…'  真实淘口令，用于口令解析和转链
#   PROBE_NUM_IID=商品ID           真实在售商品
#
# 只读 + 转链，不产生订单。转链/解析按次计费，每次几厘钱。

set -uo pipefail
KEY="${AGG_API_KEY:-}"
BASE="${AGG_BASE_URL:-https://api.tbk.dingdanxia.com}"
ADZONE="${ADZONE_ID:-}"
PID_FULL="${PID:-}"
NUM_IID="${PROBE_NUM_IID:-520813250866}"
TKL="${PROBE_TKL:-}"

[ -z "$KEY" ] && { echo "❌ 先设 AGG_API_KEY=你的key"; exit 1; }

pretty() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import sys, json
raw = sys.stdin.read()
try: d = json.loads(raw)
except Exception:
    print(raw[:1500]); sys.exit()
def trim(o):
    if isinstance(o, list):  return [trim(x) for x in o[:2]]
    if isinstance(o, dict):  return {k: trim(v) for k, v in o.items()}
    if isinstance(o, str) and len(o) > 180: return o[:180] + "…"
    return o
print(json.dumps(trim(d), ensure_ascii=False, indent=2)[:3500])
'
  else head -c 1800; fi
}

hit() {
  local name="$1" method="$2" path="$3"; shift 3
  echo ""
  echo "════════════════════════════════════════════════"
  echo "▶ $name"
  echo "  $method $path  $*"
  echo "────────────────────────────────────────────────"
  if [ "$method" = "GET" ]; then
    local qs=""; for kv in "$@"; do qs="$qs&$kv"; done
    curl -sS -m 30 "$BASE$path?apikey=$KEY$qs" | pretty
  else
    local args=(-d "apikey=$KEY"); for kv in "$@"; do args+=(-d "$kv"); done
    curl -sS -m 30 -X POST "$BASE$path" "${args[@]}" | pretty
  fi
}

echo "探测目标：$BASE"
echo "key 尾四位：...${KEY: -4}    adzoneId：${ADZONE:-未设置}    PID：${PID_FULL:-未设置}"
echo ""
echo "错误码速查："
echo "  4014 / Missing adzoneId  → 推广位没配或参数名不对"
echo "  Missing session          → 淘宝联盟账号没授权给订单侠"
echo "  4003                     → 参数不对，但接口存在"
echo "  4015                     → 路径不存在"

# ── 1. 商品库：把 adzoneId 的几种参数名都试一遍 ──
# 哪个不再报 4014，哪个就是对的
hit "商品库 · 不传推广位（对照组）" GET "/spk/optimus" "material_id=3756" "page_size=2"

if [ -n "$ADZONE" ]; then
  for pname in adzone_id adzoneId adzoneid pid; do
    hit "商品库 · 试参数 $pname" GET "/spk/optimus" "material_id=3756" "page_size=2" "$pname=$ADZONE"
  done
fi

if [ -n "$PID_FULL" ]; then
  hit "商品库 · 传完整 PID" GET "/spk/optimus" "material_id=3756" "page_size=2" "pid=$PID_FULL"
fi

# ── 2. 转链：已确认 /tbk/tkl_privilege 存在 ──
if [ -n "$TKL" ]; then
  hit "转链 · 口令版" POST "/tbk/tkl_privilege" "tkl=$TKL" ${ADZONE:+"adzone_id=$ADZONE"}
  hit "淘口令解析" POST "/tkl/query" "tkl=$TKL"
else
  echo ""
  echo "⏭  跳过口令相关：设 PROBE_TKL='整段淘宝分享文案' 再跑"
fi

hit "转链 · 商品ID版" POST "/tbk/privilege_link_id" "num_iid=$NUM_IID" ${ADZONE:+"adzone_id=$ADZONE"}
hit "转链 · 万能版"   POST "/tbk/universal" "content=$NUM_IID" ${ADZONE:+"adzone_id=$ADZONE"}

# ── 3. 订单查询 ──
S=$(date -d '-2 hour' +'%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-2H +'%Y-%m-%d %H:%M:%S')
E=$(date +'%Y-%m-%d %H:%M:%S')
hit "订单查询（近2小时）" POST "/tbk/order_details" "start_time=$S" "end_time=$E" "query_type=1" "page_size=2"

# ── 4. 渠道备案 / 会员运营：用户归属的关键 ──
# 淘客体系不能塞自定义参数，区分用户靠 relation_id 或 special_id，
# 这两个接口通不通，决定归属方案怎么做
hit "渠道备案关系列表" POST "/tbk/relation_list" "page_no=1" "page_size=2"
hit "会员运营关系列表" POST "/tbk/special_list" "page_no=1" "page_size=2"

echo ""
echo "════════════════════════════════════════════════"
echo "跑完了，把整段输出贴回对话。输出不含 apikey，可以放心贴。"
