#!/usr/bin/env bash
# Patch live nginx so /api/media/*.jpg reaches the Spotter API (not static try_files).
# Safe to re-run. Backs up the current site config first.
set -euo pipefail

CONF="${1:-/etc/nginx/sites-available/spotter}"
if [[ ! -f "$CONF" ]]; then
  echo "Config not found: $CONF" >&2
  exit 1
fi

BACKUP="${CONF}.bak.mediafix.$(date +%Y%m%d%H%M%S)"
cp -a "$CONF" "$BACKUP"
echo "Backup: $BACKUP"

python3 - "$CONF" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
orig = text

# 1) location /api/  →  location ^~ /api/  (idempotent)
text = re.sub(
    r'location\s+(?:\^~\s+)?/api/',
    'location ^~ /api/',
    text,
)

# 2) Static asset regex must not match /api/...
old = r'location\s+~\*\s+\\\.\(js\|css\|png\|jpg\|jpeg\|gif\|ico\|svg\|woff2\?\)\$'
new = r'location ~* ^/(?!api/).*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$'
text2, n = re.subn(
    r'location\s+~\*\s+\\\.\(js\|css\|png\|jpg\|jpeg\|gif\|ico\|svg\|woff2\?\)\$',
    'location ~* ^/(?!api/).*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$',
    text,
)
if n == 0:
    # Already patched, or slightly different quoting — try literal common form
    text2 = text.replace(
        r'location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$',
        r'location ~* ^/(?!api/).*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$',
    )

if text2 == orig:
    print('No changes needed (already patched?)')
else:
    path.write_text(text2)
    print('Patched', path)
PY

nginx -t
systemctl reload nginx
echo "OK — verify: curl -sI https://spottergym.ru/api/media/x/y.jpg | head -5"
echo "Expect JSON/API headers (not nginx HTML 404). Missing file → API JSON 404 is fine."
