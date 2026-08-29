#!/usr/bin/env bash
# Patch live nginx (after certbot) so www is a 301 to https://spottergym.ru.
# Does not drop SSL. Safe to re-run. Backs up the current site config first.
set -euo pipefail

CONF="${1:-/etc/nginx/sites-available/spotter}"
if [[ ! -f "$CONF" ]]; then
  echo "Config not found: $CONF" >&2
  exit 1
fi

BACKUP="${CONF}.bak.canonical.$(date +%Y%m%d%H%M%S)"
cp -a "$CONF" "$BACKUP"
echo "Backup: $BACKUP"

python3 - "$CONF" <<'PY'
import pathlib, re, sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()
orig = text

CANONICAL = "https://spottergym.ru$request_uri"
WWW_IF = (
    "    if ($host = www.spottergym.ru) {\n"
    f"        return 301 {CANONICAL};\n"
    "    }\n"
)

# Certbot / old template: keep the hostname in the redirect → glue www to apex.
text = text.replace("https://$host$request_uri", CANONICAL)
text = text.replace("http://$host$request_uri", CANONICAL)
text = text.replace("$scheme://spottergym.ru$request_uri", CANONICAL)
text = text.replace("https://www.spottergym.ru$request_uri", CANONICAL)

# Drop a leftover www if that still used $scheme (already rewritten above) or duplicates.
# Inject a www→apex if into every :443 server that still answers for www and is not
# already a redirect-only vhost.

def server_blocks(src: str):
    i = 0
    while True:
        m = re.search(r"\bserver\s*\{", src[i:])
        if not m:
            return
        start = i + m.start()
        brace = i + m.end() - 1
        depth = 0
        j = brace
        while j < len(src):
            if src[j] == "{":
                depth += 1
            elif src[j] == "}":
                depth -= 1
                if depth == 0:
                    yield start, j + 1, src[start : j + 1]
                    i = j + 1
                    break
            j += 1
        else:
            return


def listens_443(block: str) -> bool:
    return bool(re.search(r"listen\s+[^\n;]*443", block))


def names(block: str) -> list[str]:
    found = []
    for m in re.finditer(r"server_name\s+([^;]+);", block):
        found.extend(m.group(1).split())
    return found


def already_www_apex(block: str) -> bool:
    compact = re.sub(r"\s+", " ", block)
    return bool(
        re.search(
            r"if \(\$host = www\.spottergym\.ru\) \{ return 301 https://spottergym\.ru\$request_uri; \}",
            compact,
        )
    )


def redirect_only(block: str) -> bool:
    """True when the vhost's only user-facing action is a 301/302/308 to apex."""
    body = re.sub(r"server\s*\{", "", block, count=1)
    body = body.rsplit("}", 1)[0]
    # Ignore listen/ssl/include/server_name/acme
    interesting = []
    for raw in body.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if re.match(
            r"^(listen|server_name|ssl_|include|http2|root|index|access_log|error_log)\b",
            line,
        ):
            continue
        if ".well-known/acme-challenge" in line or line in ("allow all;", "}", "{"):
            continue
        if line.startswith("location ^~ /.well-known"):
            continue
        interesting.append(line)
    joined = " ".join(interesting)
    return "return 301 https://spottergym.ru$request_uri" in joined and "try_files" not in joined


pieces = []
cursor = 0
changed_inject = False
for start, end, block in server_blocks(text):
    pieces.append(text[cursor:start])
    new_block = block
    hostnames = names(block)
    if (
        listens_443(block)
        and "www.spottergym.ru" in hostnames
        and not already_www_apex(block)
        and not redirect_only(block)
    ):
        m = re.search(r"server_name\s+[^;]+;", new_block)
        if m:
            insert_at = m.end()
            new_block = new_block[:insert_at] + "\n" + WWW_IF + new_block[insert_at:]
            changed_inject = True
    pieces.append(new_block)
    cursor = end
pieces.append(text[cursor:])
text = "".join(pieces)

if text == orig:
    print("No changes needed (already canonical?)")
else:
    path.write_text(text)
    if changed_inject:
        print("Patched", path, "(www → apex on :443 + redirect targets)")
    else:
        print("Patched", path, "(redirect targets → https://spottergym.ru)")
PY

nginx -t
systemctl reload nginx
echo "OK — verify:"
echo "  curl -sI --max-redirs 0 https://www.spottergym.ru/ | grep -iE 'HTTP/|location:'"
echo "  Expect: 301  Location: https://spottergym.ru/"
echo "  curl -sI --max-redirs 0 http://www.spottergym.ru/ | grep -iE 'HTTP/|location:'"
echo "  Expect: 301  Location: https://spottergym.ru/"
