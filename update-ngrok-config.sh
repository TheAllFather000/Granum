#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$ROOT_DIR/linkhive-frontend/config.js"
NGROK_API="${NGROK_API:-http://127.0.0.1:4040/api/tunnels}"
MANUAL_URL="${1:-}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to parse ngrok API output." >&2
  exit 1
fi

if [[ -n "$MANUAL_URL" ]]; then
  NGROK_URL="$MANUAL_URL"
else
  NGROK_URL="$(python3 - "$NGROK_API" <<'PY'
import json
import sys
from urllib.request import urlopen

api = sys.argv[1]
with urlopen(api, timeout=5) as resp:
    data = json.load(resp)

public_urls = [
    t.get("public_url", "")
    for t in data.get("tunnels", [])
    if t.get("proto") == "https"
]

if not public_urls:
    raise SystemExit("No active https ngrok tunnel found.")

print(public_urls[0])
PY
)"
fi

python3 - "$CONFIG_FILE" "$NGROK_URL" <<'PY'
import re
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
url = sys.argv[2]
text = config_path.read_text(encoding="utf-8")

text = re.sub(
    r"window\.GRANUM_API_URL\s*=\s*'[^']*';",
    f"window.GRANUM_API_URL = '{url}';",
    text,
    count=1
)
text = re.sub(
    r"localStorage\.setItem\('granum_api_url',\s*'[^']*'\);",
    f"localStorage.setItem('granum_api_url', '{url}');",
    text,
    count=1
)

config_path.write_text(text, encoding="utf-8")
PY

echo "Updated linkhive-frontend/config.js with: $NGROK_URL"
