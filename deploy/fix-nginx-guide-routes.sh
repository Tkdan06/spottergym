#!/usr/bin/env bash
# Serve canonical public routes without a trailing-slash redirect.
# Safe to re-run. Backs up the current certbot-managed site config first.
set -euo pipefail

CONF="${1:-/etc/nginx/sites-available/spotter}"
if [[ ! -f "$CONF" ]]; then
  echo "Config not found: $CONF" >&2
  exit 1
fi

BACKUP="${CONF}.bak.guide-routes.$(date +%Y%m%d%H%M%S)"
cp -a "$CONF" "$BACKUP"
echo "Backup: $BACKUP"

python3 - "$CONF" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()

# `$uri/` makes nginx issue a 301 when a matching static directory exists.
# Public pages are canonical without a trailing slash, so test their generated
# `index.html` directly before falling back to the SPA entry point.
patched, count = re.subn(
    r"try_files\s+\$uri\s+\$uri/\s+/index\.html\s*;",
    "try_files $uri $uri/index.html /index.html;",
    text,
)

if count == 0:
    if "try_files $uri $uri/index.html /index.html;" in text:
        print("No changes needed (canonical route handling is already configured).")
        raise SystemExit(0)
    raise SystemExit(
        "Could not find the expected SPA try_files rule; config left unchanged."
    )

path.write_text(patched)
print(f"Patched {path} ({count} SPA route rule(s)).")
PY

nginx -t
systemctl reload nginx

echo "OK — each command below must return 200 with no Location header:"
for url in \
  'https://spottergym.ru/guide' \
  'https://spottergym.ru/guide/workouts' \
  'https://spottergym.ru/guide/workouts/training-diary' \
  'https://spottergym.ru/lp'; do
  echo "$url"
  curl -sSI --max-redirs 0 "$url" | grep -iE '^(HTTP/|location:)' || true
done
