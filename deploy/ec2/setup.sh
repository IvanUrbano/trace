#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo from the repository root: sudo bash deploy/ec2/setup.sh"
  exit 1
fi

if [ ! -f deploy/ec2/docker-compose.yml ]; then
  echo "Run this script from the repository root."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  dnf install -y docker
fi
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  mkdir -p /usr/libexec/docker/cli-plugins
  curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
    -o /usr/libexec/docker/cli-plugins/docker-compose
  chmod +x /usr/libexec/docker/cli-plugins/docker-compose
fi

if ! docker buildx version >/dev/null 2>&1; then
  mkdir -p /usr/libexec/docker/cli-plugins
  buildx_version="$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest \
    | sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p')"
  if [ -z "$buildx_version" ]; then
    echo "Could not determine the latest buildx version." >&2
    exit 1
  fi
  curl -fsSL "https://github.com/docker/buildx/releases/download/v${buildx_version}/buildx-v${buildx_version}.linux-amd64" \
    -o /usr/libexec/docker/cli-plugins/docker-buildx
  chmod +x /usr/libexec/docker/cli-plugins/docker-buildx
fi

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Install cron for automated daily database backups
if ! command -v crond >/dev/null 2>&1 && ! command -v cron >/dev/null 2>&1; then
  dnf install -y cronie
fi
systemctl enable --now crond

# Add daily 2:00 AM database backup via pg_dump (keeps last 7)
if ! crontab -l 2>/dev/null | grep -q 'backup-db.sh'; then
  (crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/trace && /opt/trace/deploy/ec2/backup-db.sh >> /var/log/trace-backup.log 2>&1") | crontab -
fi

if [ ! -f deploy/ec2/.env ]; then
  cp deploy/ec2/.env.example deploy/ec2/.env
  chmod 600 deploy/ec2/.env
  echo "Created deploy/ec2/.env from the example. Fill in the real values before starting."
fi

cat <<'EOF'

Next steps:
  1. Edit deploy/ec2/.env (database password, Cognito pool/client, allowed origin, site address).
     Use the Elastic IP with sslip.io for SITE_ADDRESS, for example: 203.0.113.10.sslip.io
  2. Start the stack:  sudo docker compose -f deploy/ec2/docker-compose.yml up -d --build
  3. Check health:     curl https://<SITE_ADDRESS>/health
  4. Logs:             sudo docker compose -f deploy/ec2/docker-compose.yml logs -f api caddy
  5. Backups:          daily pg_dump at 02:00 via cron; run manually with ./deploy/ec2/backup-db.sh
EOF
