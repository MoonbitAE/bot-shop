#!/usr/bin/env bash
# Wrapper script to run the AI-cessible-server with local temp directory
set -euo pipefail
# Determine project root
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Prepare local tmp directory for build and runtime
TMPDIR="$ROOT_DIR/tmp"
mkdir -p "$TMPDIR"
export TMPDIR
export SQLITE_TMPDIR="$TMPDIR"
# Change to server directory and run
echo "Starting Rust server with local temp dir..."
cd "$ROOT_DIR/AI-cessible-server"
cargo run "$@"