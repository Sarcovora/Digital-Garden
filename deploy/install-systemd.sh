#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
sudo install -m 0644 "$here/systemd/digital-garden-sync.service" /etc/systemd/system/
sudo install -m 0644 "$here/systemd/digital-garden-sync.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now digital-garden-sync.timer
systemctl list-timers digital-garden-sync.timer --no-pager
