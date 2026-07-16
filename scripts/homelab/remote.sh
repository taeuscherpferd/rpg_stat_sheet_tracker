#!/usr/bin/env bash

set -Eeuo pipefail

action="${1:?Action is required}"
app_root="${2:?Application root is required}"
repository_url="${3:?Repository URL is required}"
deploy_branch="${4:?Deployment branch is required}"
port="${5:?Port is required}"
release_id="${6:?Release ID is required}"
process_name='rlrpg'
database_path="$app_root/shared/rlrpg.db"

load_node_runtime() {
  if command -v node >/dev/null && command -v pnpm >/dev/null && command -v pm2 >/dev/null; then
    return
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    return
  fi

  set +u
  source "$NVM_DIR/nvm.sh"
  if ! nvm use --silent 24 >/dev/null; then
    echo 'NVM is installed, but Node.js 24 is unavailable. Run: nvm install 24' >&2
    exit 1
  fi
  set -u
}

require_command() {
  command -v "$1" >/dev/null || {
    echo "Required remote command is unavailable: $1" >&2
    exit 1
  }
}

check_prerequisites() {
  for command_name in awk curl cut df dirname find flock git install node pm2 pnpm sed sort tar; do
    require_command "$command_name"
  done

  local node_major pnpm_major
  node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
  pnpm_major="$(pnpm --version | sed -E 's/^([0-9]+).*/\1/')"
  if (( node_major < 24 || pnpm_major < 11 )); then
    echo 'The target requires Node.js 24+ and pnpm 11+.' >&2
    exit 1
  fi

  local storage_path available_kilobytes
  storage_path="$app_root"
  if [[ ! -d "$storage_path" ]]; then
    storage_path="$(dirname "$storage_path")"
  fi
  if [[ ! -d "$storage_path" || ! -w "$storage_path" ]]; then
    echo "The deployment user cannot write to $storage_path." >&2
    exit 1
  fi
  available_kilobytes="$(df -Pk "$storage_path" | awk 'NR == 2 {print $4}')"
  if (( available_kilobytes < 1048576 )); then
    echo 'The target requires at least 1 GiB of available disk space.' >&2
    exit 1
  fi

  git ls-remote --exit-code "$repository_url" "refs/heads/$deploy_branch" >/dev/null
}

health_matches() {
  local expected_release="$1"
  local response
  for _attempt in {1..30}; do
    response="$(curl --fail --silent --show-error "http://127.0.0.1:$port/api/health" 2>/dev/null || true)"
    if [[ "$response" == *'"status":"ok"'* && "$response" == *"\"releaseId\":\"$expected_release\""* ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_release() {
  local release_directory="$1"
  local active_release_id="$2"
  export DATABASE_PATH="$database_path"
  export NODE_ENV='production'
  export PORT="$port"
  export RELEASE_ID="$active_release_id"
  cd "$release_directory"
  pm2 startOrRestart ecosystem.config.json --only "$process_name" --update-env
}

configure_scheduler() {
  if [[ ! -x "$app_root/current/scripts/homelab/backup.sh" ]]; then
    echo 'Deploy the application before configuring backups.' >&2
    exit 1
  fi

  if command -v systemctl >/dev/null && systemctl is-system-running >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    local node_binary service_file timer_file
    node_binary="$(command -v node)"
    service_file="$(mktemp)"
    timer_file="$(mktemp)"
    cat > "$service_file" <<EOF
[Unit]
Description=Back up the RLRPG SQLite database

[Service]
Type=oneshot
User=$(id -un)
UMask=0077
Environment=NODE_BINARY=$node_binary
ExecStart=$app_root/current/scripts/homelab/backup.sh $app_root
EOF
    cat > "$timer_file" <<'EOF'
[Unit]
Description=Run the RLRPG database backup nightly

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=15m

[Install]
WantedBy=timers.target
EOF
    sudo install -m 0644 "$service_file" /etc/systemd/system/rlrpg-backup.service
    sudo install -m 0644 "$timer_file" /etc/systemd/system/rlrpg-backup.timer
    rm -f "$service_file" "$timer_file"
    sudo systemctl daemon-reload
    sudo systemctl enable --now rlrpg-backup.timer
    echo 'Installed the nightly systemd backup timer.'
    return
  fi

  require_command crontab
  local marker cron_entry existing_crontab node_binary
  node_binary="$(command -v node)"
  marker='# rlrpg-nightly-backup'
  cron_entry="0 3 * * * NODE_BINARY=$node_binary $app_root/current/scripts/homelab/backup.sh $app_root >> $app_root/shared/backup.log 2>&1 $marker"
  existing_crontab="$(crontab -l 2>/dev/null || true)"
  {
    printf '%s\n' "$existing_crontab" | grep -vF "$marker" || true
    printf '%s\n' "$cron_entry"
  } | crontab -
  echo 'Installed the nightly cron backup job.'
}

load_node_runtime
check_prerequisites

if [[ "$action" == 'check' ]]; then
  exit 0
fi

if [[ "$action" == 'setup' ]]; then
  configure_scheduler
  exit 0
fi

if [[ "$action" != 'deploy' ]]; then
  echo 'Unsupported remote deployment action.' >&2
  exit 1
fi

mkdir -p \
  "$app_root/releases" \
  "$app_root/shared/backups/deploy" \
  "$app_root/shared/backups/scheduled"
chmod 700 "$app_root/shared" "$app_root/shared/backups" \
  "$app_root/shared/backups/deploy" "$app_root/shared/backups/scheduled"

exec 9>"$app_root/deploy.lock"
flock -n 9 || {
  echo 'A deployment or backup is already running.' >&2
  exit 1
}

repository="$app_root/repository.git"
if [[ ! -d "$repository" ]]; then
  git clone --mirror "$repository_url" "$repository"
else
  git --git-dir="$repository" remote set-url origin "$repository_url"
fi
git --git-dir="$repository" fetch --prune origin \
  "+refs/heads/$deploy_branch:refs/heads/$deploy_branch"

remote_release_id="$(git --git-dir="$repository" rev-parse "refs/heads/$deploy_branch")"
if [[ "$remote_release_id" != "$release_id" ]]; then
  echo 'The requested release no longer matches the remote branch.' >&2
  exit 1
fi

release_name="$(date -u '+%Y%m%dT%H%M%SZ')-${release_id:0:12}"
release_directory="$app_root/releases/$release_name"
mkdir "$release_directory"
git --git-dir="$repository" archive "$release_id" | tar -x -C "$release_directory"
printf '%s\n' "$release_id" > "$release_directory/.release-id"

cd "$release_directory"
pnpm install --frozen-lockfile
pnpm build

current_link="$app_root/current"
previous_release="$(readlink -f "$current_link" 2>/dev/null || true)"
database_existed=false
deployment_backup=''
deployment_backup_target=''
if [[ -f "$database_path" ]]; then
  database_existed=true
  deployment_backup_target="$app_root/shared/backups/deploy/$release_name.db"
fi

rollback() {
  local failure_status=$?
  trap - ERR
  set +e
  pm2 stop "$process_name" >/dev/null 2>&1
  if [[ "$database_existed" == true && -f "$deployment_backup" ]]; then
    rm -f "$database_path-wal" "$database_path-shm"
    install -m 0600 "$deployment_backup" "$database_path"
  elif [[ "$database_existed" == false ]]; then
    rm -f "$database_path" "$database_path-wal" "$database_path-shm"
  fi

  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "$current_link.next"
    mv -Tf "$current_link.next" "$current_link"
    previous_release_id="$(<"$previous_release/.release-id")"
    start_release "$previous_release" "$previous_release_id"
    health_matches "$previous_release_id" || true
    pm2 save --force >/dev/null 2>&1
  else
    rm -f "$current_link"
    pm2 delete "$process_name" >/dev/null 2>&1
  fi
  echo 'Deployment failed; the previous release and database were restored.' >&2
  exit "$failure_status"
}

trap rollback ERR
if pm2 describe "$process_name" >/dev/null 2>&1; then
  pm2 stop "$process_name"
fi

if [[ "$database_existed" == true ]]; then
  chmod 600 "$database_path"
  node "$release_directory/backend/dist/backup.js" \
    create "$database_path" "$deployment_backup_target"
  deployment_backup="$deployment_backup_target"
fi

ln -sfn "$release_directory" "$current_link.next"
mv -Tf "$current_link.next" "$current_link"
start_release "$release_directory" "$release_id"
health_matches "$release_id"
pm2 save --force
trap - ERR

mapfile -t releases < <(find "$app_root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
for ((index = 3; index < ${#releases[@]}; index++)); do
  rm -rf -- "${releases[$index]}"
done

mapfile -t deployment_backups < <(find "$app_root/shared/backups/deploy" -mindepth 1 -maxdepth 1 -type f -name '*.db' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
for ((index = 10; index < ${#deployment_backups[@]}; index++)); do
  rm -f -- "${deployment_backups[$index]}"
done

echo "Deployed $release_id to http://$(hostname -I | awk '{print $1}'):$port"
