#!/usr/bin/env bash
# Starts a local n8n with the support-triage flow imported and active, at http://localhost:5678
# First run downloads n8n (a few minutes). Data stays in .n8n-local/ (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."
N8N_VERSION="${N8N_VERSION:-1.123.93}"
N8N="${N8N_BIN:-npx -y n8n@$N8N_VERSION}"
export N8N_USER_FOLDER="$PWD/.n8n-local"
export N8N_DIAGNOSTICS_ENABLED=false N8N_PERSONALIZATION_ENABLED=false N8N_SECURE_COOKIE=false N8N_RUNNERS_ENABLED=true
mkdir -p "$N8N_USER_FOLDER"
npm run --silent build:n8n
$N8N import:workflow --input=n8n/support-triage.json
$N8N update:workflow --id=blotatoTriage001 --active=true
echo "Starting n8n at http://localhost:5678 (Ctrl-C to stop)"
exec $N8N start
