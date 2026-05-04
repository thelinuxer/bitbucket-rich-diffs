#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

BROWSERS=("firefox" "chrome")
SHARED=(src lib icons LICENSE)

usage() {
  cat <<EOF
Usage: scripts/build.sh [--zip] [--browser firefox|chrome|all]

Assembles loadable extension directories under dist/<browser>/ by
copying the appropriate manifest and the shared src / lib / icons.

Options:
  --zip               After building, also produce dist/<browser>.zip.
  --browser <name>    Only build for the named browser. Default: all.
  -h, --help          Show this help.
EOF
}

want_zip=0
only=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zip) want_zip=1 ;;
    --browser) only="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

build_one() {
  local browser="$1"
  local manifest_src="manifests/${browser}.json"
  local out="dist/${browser}"

  if [[ ! -f "$manifest_src" ]]; then
    echo "missing manifest: $manifest_src" >&2
    return 1
  fi

  rm -rf "$out"
  mkdir -p "$out"
  cp "$manifest_src" "$out/manifest.json"
  for asset in "${SHARED[@]}"; do
    cp -r "$asset" "$out/"
  done
  rm -f "$out/icons/icon-source.png"

  echo "built $out"

  if [[ "$want_zip" == "1" ]]; then
    local version
    version="$(jq -r .version "$out/manifest.json")"
    local zip_path="dist/bitbucket-rich-diffs-${browser}-v${version}.zip"
    rm -f "$zip_path"
    (cd "$out" && zip -qr "../../${zip_path}" .)
    echo "zipped $zip_path"
  fi
}

if [[ -n "$only" ]]; then
  build_one "$only"
else
  for b in "${BROWSERS[@]}"; do
    build_one "$b"
  done
fi
