#!/usr/bin/env bash
# One-time server configuration for the Folio Blog.
# Run this from your LOCAL machine — it SSHes into the server and configures it.
#
# Usage:
#   DEPLOY_HOST=<host> JWT_SECRET=<secret> bash deploy/configure-server.sh
#
# Optional:
#   SSH_KEY_FILE=~/.ssh/my_key bash deploy/configure-server.sh
#
# Required env vars:
#   DEPLOY_HOST  — VM IP or hostname
#   JWT_SECRET   — secret key for JWT signing
set -euo pipefail

HOST="${DEPLOY_HOST:?Set DEPLOY_HOST to the VM IP or hostname}"
JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET before running this script}"
SSH_KEY_FILE="${SSH_KEY_FILE:-}"
REMOTE_USER="root"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY_FILE" ]] && SSH_OPTS+=(-i "$SSH_KEY_FILE")

echo "==> Configuring ${REMOTE_USER}@${HOST}..."

ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "JWT_SECRET='${JWT_SECRET}' bash -s" <<'REMOTE'
set -euo pipefail

echo "==> Creating system user 'folio'..."
if ! id folio &>/dev/null; then
    useradd --system --no-create-home --shell /sbin/nologin folio
fi

echo "==> Creating app directories..."
mkdir -p /opt/folio/{admin/dist,site/dist,site/src,uploads,data}
chown -R folio:folio /opt/folio

echo "==> Installing Node.js (LTS)..."
if ! command -v node &>/dev/null; then
    if command -v dnf &>/dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -
        dnf install -y nodejs
    elif command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
        apt-get install -y nodejs
    else
        echo "ERROR: unsupported package manager (not dnf/apt)" >&2
        exit 1
    fi
fi
echo "    node $(node --version), npm $(npm --version)"

echo "==> Installing WebP image tools..."
if ! command -v cwebp &>/dev/null; then
    if command -v apt-get &>/dev/null; then
        apt-get update
        apt-get install -y webp
    elif command -v dnf &>/dev/null; then
        dnf install -y libwebp-tools
    else
        echo "WARNING: cwebp is unavailable; image uploads will be stored without optimization" >&2
    fi
fi

echo "==> Writing /etc/folio.env..."
cat > /etc/folio.env <<EOF
PORT=8082
UPLOAD_DIR=/opt/folio/uploads
DB_PATH=/opt/folio/data/blog.db
JWT_SECRET=${JWT_SECRET}
SITE_BUILD_SCRIPT=/opt/folio/site/build.sh
SITE_DIST=/opt/folio/site/dist
BACKEND_URL=http://localhost:8082
EOF
chmod 600 /etc/folio.env

echo "==> Installing systemd service..."
cat > /etc/systemd/system/ <<'EOF'
[Unit]
Description=Folio Blog Server
After=network.target

[Service]
User=folio
WorkingDirectory=/opt/folio
EnvironmentFile=/etc/folio.env
Environment=HOME=/opt/folio
ExecStart=/opt/folio/folio-server
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable folio
REMOTE

echo ""
echo "Server configured. Run the deploy script to upload artifacts and start the service:"
echo "  DEPLOY_HOST=${HOST} SSH_KEY_FILE=${SSH_KEY_FILE:-~/.ssh/id_rsa} bash deploy/deploy.sh"
