#!/usr/bin/env bash
set -Eeuo pipefail

set -m

./ioq3ded "$@" &
Q3_PID=$!

cleanup() {
  echo "Shutting down..."
  kill -TERM -$Q3_PID 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM

wait $Q3_PID
