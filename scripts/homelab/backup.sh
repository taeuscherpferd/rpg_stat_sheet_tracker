#!/usr/bin/env bash

set -euo pipefail
umask 077

app_root="${1:?Application root is required}"
database_path="$app_root/shared/rlrpg.db"
backup_directory="$app_root/shared/backups/scheduled"

if [[ ! -f "$database_path" ]]; then
  echo "Database does not exist: $database_path" >&2
  exit 1
fi

mkdir -p "$backup_directory"
exec 9>"$app_root/deploy.lock"
flock -n 9 || {
  echo 'A deployment or backup is already running.' >&2
  exit 1
}

"${NODE_BINARY:-node}" "$app_root/current/backend/dist/backup.js" \
  scheduled "$database_path" "$backup_directory" 14
