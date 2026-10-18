#!/bin/sh
set -e

# If arguments were provided to docker run, execute them instead
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Starting Latch Backend on port 3001..."
node backend/server.js --port 3001 &
BACKEND_PID=$!

echo "Starting Latch Mission Control UI on port 3002..."
npm run start -w mission-control &
UI_PID=$!

# Graceful shutdown handler
cleanup() {
  echo "Shutting down Latch..."
  kill -TERM "$BACKEND_PID" 2>/dev/null || true
  kill -TERM "$UI_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$UI_PID" 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
