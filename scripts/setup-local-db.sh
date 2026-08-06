#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ps1_script="$script_dir/setup-local-db.ps1"

if [[ ! -f "$ps1_script" ]]; then
  echo "Could not find PowerShell script: $ps1_script" >&2
  exit 1
fi

if command -v pwsh >/dev/null 2>&1; then
  exec pwsh -NoProfile -File "$ps1_script" "$@"
elif command -v powershell >/dev/null 2>&1; then
  exec powershell -NoProfile -ExecutionPolicy Bypass -File "$ps1_script" "$@"
else
  echo "PowerShell was not found. Install pwsh or powershell and try again." >&2
  exit 1
fi
