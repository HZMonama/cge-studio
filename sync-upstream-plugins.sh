#!/usr/bin/env bash
#
# sync-upstream-plugins.sh - Sync new plugins from upstream claude-grc-engineering to cli-grc-engineering
#
# Usage: ./sync-upstream-plugins.sh [--dry-run]
#
# This script:
# 1. Fetches upstream main branch
# 2. Finds plugins in upstream that don't exist in our fork
# 3. Copies them with git checkout
# 4. Commits the changes
# 5. Optionally restarts the runner

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="${SCRIPT_DIR}/cli/cli-grc-engineering"
DRY_RUN=false
RESTART_RUNNER=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
  echo "Usage: $0 [--dry-run] [--restart-runner]"
  echo ""
  echo "Options:"
  echo "  --dry-run         Show what would be synced without making changes"
  echo "  --restart-runner  Restart the runner after syncing"
  exit 1
}

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --restart-runner)
      RESTART_RUNNER=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      ;;
  esac
done

cd "$CLI_DIR"

# Ensure upstream remote exists
if ! git remote | grep -q "^upstream$"; then
  log_info "Adding upstream remote..."
  git remote add upstream https://github.com/ethanolivertroy/claude-grc-engineering.git
fi

# Fetch upstream
log_info "Fetching upstream main branch..."
git fetch upstream main --quiet

# Get list of plugins in upstream
log_info "Scanning upstream for plugins..."
UPSTREAM_PLUGINS=$(git ls-tree -r upstream/main --name-only | grep -E "^plugins/(connectors|frameworks)/[^/]+/.claude-plugin/plugin\.json$" | cut -d/ -f2-3 | sort -u)

# Get list of plugins in our fork
LOCAL_PLUGINS=$(find plugins -name "plugin.json" -path "*/.claude-plugin/*" 2>/dev/null | cut -d/ -f2-3 | sort -u)

# Find new plugins
NEW_PLUGINS=$(comm -23 <(echo "$UPSTREAM_PLUGINS") <(echo "$LOCAL_PLUGINS"))

if [[ -z "$NEW_PLUGINS" ]]; then
  log_info "No new plugins to sync. Everything is up to date!"
  exit 0
fi

log_info "Found new plugins to sync:"
echo "$NEW_PLUGINS" | while read -r plugin; do
  echo "  - $plugin"
done

if [[ "$DRY_RUN" == true ]]; then
  log_info "Dry run mode - no changes made."
  exit 0
fi

# Checkout each new plugin
log_info "Syncing plugins..."
echo "$NEW_PLUGINS" | while read -r plugin; do
  log_info "Copying $plugin..."
  git checkout upstream/main -- "$plugin"
  
  # Get plugin name from plugin.json
  PLUGIN_NAME=$(git show upstream/main:"$plugin/.claude-plugin/plugin.json" 2>/dev/null | grep '"name"' | head -1 | cut -d'"' -f4 || echo "$plugin")
  log_info "  ✓ $PLUGIN_NAME"
done

# Stage and commit
log_info "Committing changes..."
git add -A

# Generate commit message with plugin list
COMMIT_MSG="Sync upstream plugins

Added plugins from ethanolivertroy/claude-grc-engineering main:"
echo "$NEW_PLUGINS" | while read -r plugin; do
  PLUGIN_NAME=$(echo "$plugin" | cut -d/ -f2)
  COMMIT_MSG="${COMMIT_MSG}
- ${PLUGIN_NAME}"
done

git commit -m "$COMMIT_MSG"

log_info "Pushing to fork..."
git push

if [[ "$RESTART_RUNNER" == true ]]; then
  log_info "Restarting runner..."
  RUNNER_PIDS=$(ps aux | grep "server.js" | grep -v grep | awk '{print $2}' || true)
  if [[ -n "$RUNNER_PIDS" ]]; then
    echo "$RUNNER_PIDS" | xargs kill 2>/dev/null || true
    sleep 2
  fi
  
  cd "${SCRIPT_DIR}/apps/runner"
  nohup node --watch src/server.js > /dev/null 2>&1 &
  sleep 3
  
  # Verify runner is up
  if curl -s http://localhost:3333/health > /dev/null 2>&1; then
    PLUGIN_COUNT=$(curl -s http://localhost:3333/registry/plugins | jq '.plugins | length')
    log_info "Runner restarted successfully. Total plugins: $PLUGIN_COUNT"
  else
    log_warn "Runner may not have started properly"
  fi
fi

log_info "Sync complete!"
