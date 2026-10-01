#!/bin/sh
# Usage: run-claude.sh <direct|dial|codemie> -- <claude args>
set -eu
if [ "$#" -lt 1 ]; then
  echo "Usage: run-claude.sh <mode> -- <claude args>" >&2
  exit 2
fi
root=$(cd -- "$(dirname -- "$0")/../.." && pwd -P)
mode=$1
shift
cd "$root"
exec node scripts/telemetry/claude.mjs --runtime "$mode" "$@"
