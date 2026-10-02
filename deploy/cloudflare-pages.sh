#!/usr/bin/env bash
# Cloudflare Pages build (Git integration). Build command: bash deploy/cloudflare-pages.sh   Output directory: dist
# Environment variables in Pages: SITE_URL=https://<your domain>, NODE_VERSION=22, PYTHON_VERSION=3.11
set -euo pipefail
: "${SITE_URL:?set SITE_URL in the Pages project settings}"
(cd app && npm ci --no-audit --no-fund)
(cd admin && npm ci --no-audit --no-fund)
python3 site/tools/build_all.py "$SITE_URL" --skip-landing
