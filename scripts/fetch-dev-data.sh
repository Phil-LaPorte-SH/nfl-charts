#!/usr/bin/env bash
# Build a local copy of the data mirror for development.
# Usage: scripts/fetch-dev-data.sh [seasons]   (default: all; e.g. "2023,2025" or "2018-2026")
set -euo pipefail
DATA_REPO="${NFL_DATA_REPO:-$(cd "$(dirname "$0")/../.." && pwd)/nfl-charts-data}"
SEASONS="${1:-all}"
if [ ! -d "$DATA_REPO" ]; then
  git clone https://github.com/Phil-LaPorte-SH/nfl-charts-data.git "$DATA_REPO"
fi
cd "$DATA_REPO"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r scripts/requirements.txt
cd scripts
../.venv/bin/python list_assets.py > ../assets.json
../.venv/bin/python sync.py --dest ../site --assets ../assets.json --seasons "$SEASONS"
../.venv/bin/python fetch_logos.py --dest ../site
../.venv/bin/python build_manifest.py --dest ../site
echo "Data ready in $DATA_REPO/site. Run: npm run dev"
