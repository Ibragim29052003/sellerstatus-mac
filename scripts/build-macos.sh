#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
GO_COMMAND="${GO_BIN:-}"
if [[ -z "$GO_COMMAND" ]]; then
  GO_COMMAND="$(command -v go || true)"
fi
if [[ -z "$GO_COMMAND" && -x "$PROJECT_ROOT/../../work/toolchain/go/bin/go" ]]; then
  GO_COMMAND="$PROJECT_ROOT/../../work/toolchain/go/bin/go"
  export GOPATH="$PROJECT_ROOT/../../work/go-path"
  export GOMODCACHE="$PROJECT_ROOT/../../work/go-mod"
  export GOCACHE="$PROJECT_ROOT/../../work/go-cache"
fi
if [[ -z "$GO_COMMAND" ]]; then
  echo 'Go не найден. Установите Go 1.27+ или задайте GO_BIN.' >&2
  exit 1
fi
(cd frontend && npm run build)
export CGO_CFLAGS="${CGO_CFLAGS:-} -mmacosx-version-min=13.0"
export CGO_LDFLAGS="${CGO_LDFLAGS:-} -mmacosx-version-min=13.0"
# Sign outside the synced Documents folder: Finder/File Provider may attach
# resource-fork metadata while the bundle is being signed there.
STAGE_DIR="$(mktemp -d /private/tmp/sellerstatus-build.XXXXXX)"
trap 'rm -rf "$STAGE_DIR"' EXIT
APP_ROOT="$STAGE_DIR/SellerStatus Mac.app"
mkdir -p "$APP_ROOT/Contents/MacOS" "$APP_ROOT/Contents/Resources"
"$GO_COMMAND" build -tags production -trimpath -ldflags='-s -w' -o "$APP_ROOT/Contents/MacOS/sellerstatus-mac" .
cp assets/Info.plist "$APP_ROOT/Contents/Info.plist"
if [[ -d "$PROJECT_ROOT/.local/planner" ]]; then
  /usr/bin/ditto --norsrc --noextattr "$PROJECT_ROOT/.local/planner" "$APP_ROOT/Contents/Resources/planner"
  /usr/libexec/PlistBuddy -c 'Set :LSMinimumSystemVersion 14.0' "$APP_ROOT/Contents/Info.plist"
  # Self-contained .NET contains native libraries and an apphost. Sign each
  # native Mach-O before sealing the enclosing application bundle.
  python3 "$PROJECT_ROOT/scripts/sign-planner.py" "$APP_ROOT/Contents/Resources/planner"
fi
printf 'APPL????'  > "$APP_ROOT/Contents/PkgInfo"
/usr/bin/xattr -cr "$APP_ROOT"
/usr/bin/codesign --force --deep --sign - "$APP_ROOT"
/usr/bin/codesign --verify --deep --strict "$APP_ROOT"
mkdir -p "$PROJECT_ROOT/build"
python3 "$PROJECT_ROOT/scripts/install-bundle.py" "$APP_ROOT" "$PROJECT_ROOT/build/SellerStatus Mac.app"
/usr/bin/ditto -c -k --keepParent --norsrc --noextattr "$APP_ROOT" "$PROJECT_ROOT/build/SellerStatus-Mac-demo.zip"
echo "Готово: $PROJECT_ROOT/build/SellerStatus Mac.app"
echo "Архив: $PROJECT_ROOT/build/SellerStatus-Mac-demo.zip"
