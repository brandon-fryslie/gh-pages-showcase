#!/usr/bin/env bash
# Drop coi-serviceworker.js into a consumer's public/ directory so GitHub
# Pages can enable cross-origin isolation (a CheerpX requirement).
#
# Usage:
#     setup-coi.sh [target-dir]
#
# Defaults to ./public.
#
# coi-serviceworker is MIT-licensed: https://github.com/gzuidhof/coi-serviceworker
# It registers a SW that adds COOP/COEP headers to every response, then reloads
# once on first install. After registration, SharedArrayBuffer becomes available
# and CheerpX can boot.

set -euo pipefail
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
log() { printf '\033[36m›\033[0m %s\n' "$*" >&2; }

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

TARGET="${1:-public}"
URL="https://raw.githubusercontent.com/gzuidhof/coi-serviceworker/master/coi-serviceworker.min.js"

[[ -d "$TARGET" ]] || die "target dir not found: $TARGET (create it first or pass a path)"
command -v curl >/dev/null || die "curl is required on PATH"

log "downloading coi-serviceworker.min.js → $TARGET/"
curl -fsSL "$URL" -o "$TARGET/coi-serviceworker.js"

# Sanity check: the file should look like a service worker.
grep -q 'serviceWorker' "$TARGET/coi-serviceworker.js" \
  || die "downloaded file does not look like a service worker; aborting"

cat <<EOF
done. Add this line to your index.html <head> (before any module scripts):

    <script src="coi-serviceworker.js"></script>

EOF
