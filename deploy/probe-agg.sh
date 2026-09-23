#!/usr/bin/env bash
# 订单侠接口探测：把真实返回打出来，用于确认字段映射。
#
# 在服务器上跑（容器/本机代理可能拦外部域名，直接在宿主机跑最稳）：
#   chmod +x deploy/probe-agg.sh
#   AGG_API_KEY=你的key ./deploy/probe-agg.sh 2>&1 | tee /tmp/agg-probe.log
#
# 只读 + 转链，不会产生订单。转链/解析按次计费，每次几厘钱。
#
# ⚠️ 跑之前先在订单侠后台完成：个人中心 → 授权管理 → 淘宝授权
#    （绑定淘宝联盟账号拿 session + 填推广位 PID/adzoneId）
#    没配的话会看到 4014 PID异常 或 Missing session。

set -uo pipefail
KEY="${AGG_API_KEY:-}"
BASE="${AGG_BASE_URL:-https://api.tbk.dingdanxia.com}"
# 拿一个真实在售的商品 ID 试转链，默认这个可能已下架，建议自己换一个
NUM_IID="${PROBE_NUM_IID:-520813250866}"
# 真实淘口令：从淘宝 App 分享任意商品复制过来，整段粘进来都行
TKL="${PROBE_TKL:-}"

if [ -z "$KEY" ]; then
  echo "❌ 先设 AGG_API_KEY=你的key"
  exit 1
fi

pretty() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw[:1500]); sys.exit()

def trim(o):
    if isinstance(o, list):
        return [trim(x) for x in o[:2]]
    if isinstance(o, dict):
        return {k: trim(v) for k, v in o.items()}
    if isinstance(o, str) and len(o) > 180:
        return o[:180] + "…"
    return o

print(json.dumps(trim(d), ensure_ascii=False, indent=2)[:3500])
'
  else
    head -c 1800
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
echo ""
echo "错误码速查：4014=推广位PID没配  Missing session=淘宝联盟账号没授权"
echo "            4003=参数不对(接口存在)  4015=路径不存在  4005=超调用限制"

# ── 1. 官方商品库榜单（选品）───────────────────────
# material_id 各榜单编号，先试好券直播
hit "商品库 · 好券直播" GET "/spk/optimus" "material_id=3756" "page_size=2" "page_no=1"

# ── 2. 淘口令解析 ────────────────────────────────
if [ -n "$TKL" ]; then
  hit "淘口令解析（真实口令）" POST "/tkl/query" "tkl=$TKL"
else
  echo ""
  echo "⏭  跳过淘口令解析：设 PROBE_TKL='整段淘宝分享文案' 再跑一次"
fi

# ── 3. 转链（已确认路径）─────────────────────────
if [ -n "$TKL" ]; then
  hit "转链 · 口令版" POST "/tbk/tkl_privilege" "tkl=$TKL"
fi
hit "转链 · 商品ID版" POST "/tbk/privilege_link_id" "num_iid=$NUM_IID"
hit "转链 · 万能版" POST "/tbk/universal" "content=$NUM_IID"

# ── 4. 订单查询 ──────────────────────────────────
S=$(date -d '-2 hour' +'%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-2H +'%Y-%m-%d %H:%M:%S')
E=$(date +'%Y-%m-%d %H:%M:%S')
hit "订单查询（近2小时）" POST "/tbk/order_details" "start_time=$S" "end_time=$E" "query_type=1" "page_size=2"

# ── 5. 渠道/会员运营：用户归属的关键 ──────────────
# 返利平台靠 relation_id 或 special_id 区分是哪个用户买的，
# 这两个接口能不能用，决定归属方案怎么做
hit "渠道备案关系列表" POST "/tbk/relation_list" "page_no=1" "page_size=2"
hit "会员运营关系列表" POST "/tbk/special_list" "page_no=1" "page_size=2"

echo ""
echo "════════════════════════════════════════════════"
echo "跑完了。把整段输出贴回对话，我照着做字段映射。"
echo "输出里不含 apikey，可以放心贴。"
