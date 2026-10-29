#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ROOT="$PROJECT_ROOT/build/SellerStatus Mac.app"
if [[ ! -d "$APP_ROOT" ]]; then "$PROJECT_ROOT/scripts/build-macos.sh"; fi
open "$APP_ROOT"
