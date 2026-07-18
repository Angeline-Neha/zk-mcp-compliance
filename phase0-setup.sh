#!/usr/bin/env bash
# Phase 0 — ZK-MCP-Auth-Compliance
# Run this once inside your GitHub Codespace, from the repo root.
set -euo pipefail

echo "==> Creating workspace structure"
mkdir -p packages/sigma-core/src packages/sigma-core/test
mkdir -p packages/compliance-circuits/circuits packages/compliance-circuits/build packages/compliance-circuits/scripts
mkdir -p packages/compliance-proving-service/src
mkdir -p packages/issuer-service/src
mkdir -p packages/finance-mcp-server/src
mkdir -p packages/admin-mcp-server/src
mkdir -p packages/orchestrator-agent/src
mkdir -p packages/support-agent/src
mkdir -p packages/admin-agent/src
mkdir -p packages/shared
mkdir -p frontend/src/views frontend/src/lib
mkdir -p docs

echo "==> Root package.json"
cat > package.json <<'EOF'
{
  "name": "zk-mcp-compliance",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
EOF

echo "==> pnpm-workspace.yaml"
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "packages/*"
  - "frontend"
EOF

echo "==> Stub package.json for each backend package"
for pkg in sigma-core compliance-proving-service issuer-service finance-mcp-server admin-mcp-server orchestrator-agent support-agent admin-agent; do
cat > "packages/$pkg/package.json" <<EOF
{
  "name": "@zk-mcp/$pkg",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
EOF
touch "packages/$pkg/src/.gitkeep"
done

echo "==> tsconfig.base.json"
cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true
  }
}
EOF

echo "==> docker-compose.yml (Redis + Postgres, running from day 1)"
cat > docker-compose.yml <<'EOF'
version: "3.9"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: zkmcp
      POSTGRES_PASSWORD: zkmcp
      POSTGRES_DB: zkmcp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zkmcp"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
EOF

echo "==> .gitignore"
cat > .gitignore <<'EOF'
node_modules/
dist/
build/
*.log
.env
packages/compliance-circuits/build/*
!packages/compliance-circuits/build/.gitkeep
EOF
touch packages/compliance-circuits/build/.gitkeep

echo "==> docs stubs (fill these in as you go — required by the spec)"
touch docs/threat-model.md docs/policy-sources.md docs/benchmark-results.md

echo "==> Installing pnpm (if missing) and dependencies"
if ! command -v pnpm &> /dev/null; then
  corepack enable
  corepack prepare pnpm@latest --activate
fi
pnpm install

echo "==> Bringing up Redis + Postgres"
docker compose up -d
docker compose ps

echo "==> Checking / installing circom"
if ! command -v circom &> /dev/null; then
  echo "circom not found — installing via cargo (needs Rust)"
  if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
  fi
  git clone https://github.com/iden3/circom.git /tmp/circom
  cd /tmp/circom
  cargo build --release
  cargo install --path circom
  cd -
fi
circom --version

echo "==> Installing snarkjs globally"
npm install -g snarkjs
snarkjs --version || true

echo ""
echo "=================================================="
echo " Phase 0 complete."
echo " - Workspace scaffolded under packages/ and frontend/"
echo " - Redis + Postgres running (docker compose ps to check)"
echo " - circom + snarkjs installed"
echo ""
echo "Next: cd packages/sigma-core and start Phase 1"
echo "=================================================="
