#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_directory/../.." && pwd)"
configuration_file="${DEPLOY_ENV_FILE:-$project_root/.env.deploy}"
action="${1:-deploy}"

if [[ ! -f "$configuration_file" ]]; then
  echo "Missing $configuration_file. Copy .env.deploy.example and update it." >&2
  exit 1
fi

set -a
source "$configuration_file"
set +a

required_variable() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deployment setting: $name" >&2
    exit 1
  fi
}

for variable in DEPLOY_HOST APP_ROOT PORT REPOSITORY_URL DEPLOY_BRANCH; do
  required_variable "$variable"
done

if [[ "$DEPLOY_HOST" == -* || ! "$APP_ROOT" =~ ^/[a-zA-Z0-9._/-]+$ || ! "$PORT" =~ ^[0-9]+$ || ! "$DEPLOY_BRANCH" =~ ^[a-zA-Z0-9._/-]+$ ]]; then
  echo 'DEPLOY_HOST, APP_ROOT, PORT, or DEPLOY_BRANCH has an invalid value.' >&2
  exit 1
fi
if (( PORT < 1 || PORT > 65535 )); then
  echo 'PORT must be between 1 and 65535.' >&2
  exit 1
fi

for command_name in git pnpm ssh; do
  command -v "$command_name" >/dev/null || {
    echo "Required local command is unavailable: $command_name" >&2
    exit 1
  }
done

quoted() {
  printf '%q' "$1"
}

run_remote() {
  local remote_command
  remote_command="bash -s -- $(quoted "$1") $(quoted "$APP_ROOT") $(quoted "$REPOSITORY_URL") $(quoted "$DEPLOY_BRANCH") $(quoted "$PORT") $(quoted "$2")"
  ssh "$DEPLOY_USER@$DEPLOY_HOST" "$remote_command" < "$script_directory/remote.sh"
}

cd "$project_root"
git fetch origin "$DEPLOY_BRANCH"
release_id="$(git rev-parse HEAD)"

if [[ "$action" == 'check' ]]; then
  run_remote check "$release_id"
  echo 'Homelab deployment prerequisites are ready.'
  exit 0
fi

if [[ "$action" == 'setup' ]]; then
  run_remote setup "$release_id"
  exit 0
fi

if [[ "$action" != 'deploy' ]]; then
  echo 'Usage: deploy.sh [check|deploy|setup]' >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo 'The working tree must be clean before deployment.' >&2
  exit 1
fi

remote_release_id="$(git rev-parse "origin/$DEPLOY_BRANCH")"
if [[ "$release_id" != "$remote_release_id" ]]; then
  echo "HEAD must match pushed origin/$DEPLOY_BRANCH before deployment." >&2
  exit 1
fi

pnpm test
pnpm lint
pnpm format:check
run_remote deploy "$release_id"
