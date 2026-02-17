#!/usr/bin/env bash
set -euo pipefail

# purge-cloudflare.sh
# Usage: set CF_ZONE and CF_TOKEN in env or pass --zone ZONE --token TOKEN
# Options:
#   --files url1,url2,...    Purge specific file URLs (recommended)
#   --file-list path         Purge list of URLs (one per line) from a file
#   --all                    Purge everything (use with caution)
#   --zone ZONE_ID           Cloudflare Zone ID (overrides CF_ZONE env)
#   --token API_TOKEN        Cloudflare API Token (overrides CF_TOKEN env)
#   -h|--help                Show this help

print_usage(){
  sed -n '1,120p' "$0" | sed -n '1,120p'
}

if [ "$#" -eq 0 ]; then
  echo "No arguments provided. Use -h for help." >&2
  exit 1
fi

FILES=
FILE_LIST=
PURGE_ALL=false
ZONE=
TOKEN=

while [[ $# -gt 0 ]]; do
  case "$1" in
    --files) FILES="$2"; shift 2;;
    --file-list) FILE_LIST="$2"; shift 2;;
    --all) PURGE_ALL=true; shift;;
    --zone) ZONE="$2"; shift 2;;
    --token) TOKEN="$2"; shift 2;;
    -h|--help) print_usage; exit 0;;
    *) echo "Unknown argument: $1" >&2; print_usage; exit 1;;
  esac
done

# prefer explicit args, fall back to env vars
: "${ZONE:="$CF_ZONE"}" || true
: "${TOKEN:="$CF_TOKEN"}" || true

if [ -z "$ZONE" ]; then
  echo "Error: Zone ID not provided. Set CF_ZONE or use --zone." >&2
  exit 2
fi
if [ -z "$TOKEN" ]; then
  echo "Error: API token not provided. Set CF_TOKEN or use --token." >&2
  exit 2
fi

PAYLOAD=
if [ "$PURGE_ALL" = true ]; then
  PAYLOAD='{"purge_everything":true}'
else
  URLS=()
  if [ -n "$FILES" ]; then
    IFS=',' read -ra ADDR <<< "$FILES"
    for u in "${ADDR[@]}"; do
      URLS+=("$u")
    done
  fi
  if [ -n "$FILE_LIST" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      trimmed=$(echo "$line" | tr -d '\r' | sed -e 's/^\s*//;s/\s*$//')
      [ -n "$trimmed" ] && URLS+=("$trimmed")
    done < "$FILE_LIST"
  fi

  if [ ${#URLS[@]} -eq 0 ]; then
    echo "Error: no URLs provided for targeted purge. Use --files or --file-list." >&2
    exit 3
  fi

  # Build JSON array
  urls_json=$(printf '%s\n' "${URLS[@]}" | python3 -c 'import sys, json; print(json.dumps([l.strip() for l in sys.stdin]))')
  PAYLOAD=$(printf '{"files":%s}' "$urls_json")
fi

echo "Purging Cloudflare cache for zone: $ZONE"
echo "Payload: $PAYLOAD"

resp=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD")

echo "Response:" 
echo "$resp" | python3 -m json.tool || echo "$resp"

ok=$(echo "$resp" | python3 -c 'import sys, json; j=json.load(sys.stdin); print(j.get("success", False))' 2>/dev/null || true)
if [ "$ok" = "True" ] || [ "$ok" = "true" ]; then
  echo "Purge request succeeded."
  exit 0
else
  echo "Purge request failed. Check output above." >&2
  exit 4
fi
