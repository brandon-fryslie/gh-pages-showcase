#!/usr/bin/env bash
# Upload a WebVM disk image to a GitHub Release as the canonical hosting
# location for CheerpX to range-request.
#
# Usage:
#     upload-image.sh --image disk.ext2 --repo owner/name --tag webvm-image-v1 \
#                     [--title "WebVM disk image v1"] [--notes-file NOTES.md]
#
# Idempotent: if the release tag exists, the asset is replaced; otherwise the
# release is created.
#
# [LAW:single-enforcer] One canonical place per project: a release on the
# project's own repo. CheerpX HTTP-range-requests directly from
# `https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>`.

set -euo pipefail
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
log() { printf '\033[36m›\033[0m %s\n' "$*" >&2; }

IMAGE=""
REPO=""
TAG=""
TITLE=""
NOTES_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)      IMAGE="$2";      shift 2 ;;
    --repo)       REPO="$2";       shift 2 ;;
    --tag)        TAG="$2";        shift 2 ;;
    --title)      TITLE="$2";      shift 2 ;;
    --notes-file) NOTES_FILE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$IMAGE" ]] || die "--image is required"
[[ -n "$REPO"  ]] || die "--repo is required (owner/name)"
[[ -n "$TAG"   ]] || die "--tag is required"
[[ -f "$IMAGE" ]] || die "image not found: $IMAGE"
[[ -z "$TITLE" ]] && TITLE="WebVM disk image — $TAG"

command -v gh >/dev/null || die "gh CLI is required on PATH"

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  log "release $TAG exists on $REPO; replacing asset"
  gh release upload "$TAG" "$IMAGE" --repo "$REPO" --clobber
else
  log "creating release $TAG on $REPO"
  if [[ -n "$NOTES_FILE" ]]; then
    [[ -f "$NOTES_FILE" ]] || die "notes file not found: $NOTES_FILE"
    gh release create "$TAG" "$IMAGE" --repo "$REPO" --title "$TITLE" --notes-file "$NOTES_FILE"
  else
    gh release create "$TAG" "$IMAGE" --repo "$REPO" --title "$TITLE" \
      --notes "WebVM disk image. Built with showcase-kit/webvm/build-image.sh. Streamed by CheerpX via HTTP range requests."
  fi
fi

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/$(basename "$IMAGE")"
log "uploaded. WebVMTerminal diskImage.url:"
printf '%s\n' "$DOWNLOAD_URL"
