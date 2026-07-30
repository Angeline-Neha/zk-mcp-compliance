#!/bin/bash
echo "Stopping any existing node processes..."
killall node 2>/dev/null || true

echo "Loading environment variables from .env..."
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "Warning: .env file not found"
fi

echo "Starting all services and frontend in parallel..."
pnpm -r --parallel dev
