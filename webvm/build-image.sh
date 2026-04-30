#!/usr/bin/env bash
# Build a WebVM ext2 disk image from a project's Dockerfile.
#
# Usage:
#     build-image.sh --dockerfile <path> --out <path/to/disk.ext2> [options]
#
# Options:
#     --dockerfile PATH    Project Dockerfile (required)
#     --context PATH       Docker build context (default: dirname of Dockerfile)
#     --out PATH           Output disk image path (required, e.g. ./disk.ext2)
#     --size SIZE          ext2 image size, e2fsprogs syntax (default: 2G)
#     --tag NAME           Docker image tag for the rootfs (default: webvm-rootfs:latest)
#     --build-arg K=V      Pass through to docker build (repeatable)
#     --base-tag NAME      Optional: tag of the showcase-kit base image to ensure
#                          is built first from Dockerfile.base in this directory.
#
# Pipeline:
#   1. (optional) docker build the showcase-kit base image
#   2. docker build the project image (FROM the base)
#   3. docker create + docker export → tar of rootfs
#   4. mke2fs -d <rootfs> -t ext2 <out> <size>  (run inside a tooling container
#      so macOS users without e2fsprogs locally still work)
#
# Output is suitable for CheerpX CloudDevice/HttpBytesDevice and for upload via
# upload-image.sh.
#
# [LAW:dataflow-not-control-flow] Same operations every invocation: build → export
# → mke2fs. Project-specific variation lives in the input Dockerfile, not in
# branched code paths in this script.

set -euo pipefail

# --- Configurable failure handling ----------------------------------------
# Per <scripting-discipline>: never swallow errors. We `set -eo pipefail`
# above and validate every external call's output before using it.

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
log() { printf '\033[36m›\033[0m %s\n' "$*" >&2; }

DOCKERFILE=""
CONTEXT=""
OUT=""
SIZE="2G"
TAG="webvm-rootfs:latest"
BASE_TAG=""
BUILD_ARGS=()
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dockerfile) DOCKERFILE="$2"; shift 2 ;;
    --context)    CONTEXT="$2";    shift 2 ;;
    --out)        OUT="$2";        shift 2 ;;
    --size)       SIZE="$2";       shift 2 ;;
    --tag)        TAG="$2";        shift 2 ;;
    --base-tag)   BASE_TAG="$2";   shift 2 ;;
    --build-arg)  BUILD_ARGS+=(--build-arg "$2"); shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$DOCKERFILE" ]] || die "--dockerfile is required"
[[ -n "$OUT" ]]        || die "--out is required"
[[ -f "$DOCKERFILE" ]] || die "dockerfile not found: $DOCKERFILE"
[[ -z "$CONTEXT" ]] && CONTEXT="$(dirname "$DOCKERFILE")"
[[ -d "$CONTEXT" ]]    || die "context dir not found: $CONTEXT"

command -v docker >/dev/null || die "docker is required on PATH"

mkdir -p "$(dirname "$OUT")"
OUT_ABS="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

# [LAW:single-enforcer] The build is a single buildx invocation against a
# combined multi-stage Dockerfile. We can't rely on FROM resolving across
# successive builds because buildx's docker-container driver keeps images in
# its own cache, not in the host docker images list — so any cross-build
# FROM <tag> tries the remote registry and fails. Concatenating Base +
# project into one Dockerfile eliminates the race entirely.

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
COMBINED="$WORKDIR/Dockerfile.combined"

# Generate a stage name from the base FROM line and rewrite the project's
# FROM showcase-kit-webvm-base:latest to point at that stage.
{
  sed 's/^FROM debian:bookworm-slim$/FROM debian:bookworm-slim AS webvm_base/' \
    "$SCRIPT_DIR/Dockerfile.base"
  echo
  echo '# --- project layer (concatenated from project Dockerfile) ---'
  sed 's|^FROM showcase-kit-webvm-base:latest$|FROM webvm_base|' "$DOCKERFILE"
} > "$COMBINED"

log "building combined image (base + project) → $TAG"
docker buildx build --load "${BUILD_ARGS[@]}" -t "$TAG" -f "$COMBINED" "$CONTEXT"
[[ -n "$BASE_TAG" ]] && docker tag "$TAG" "$BASE_TAG" 2>/dev/null || true

# 3. Export rootfs as a tar stream into the temp dir.
log "exporting rootfs to $WORKDIR/rootfs.tar"
CID="$(docker create "$TAG")"
[[ -n "$CID" ]] || die "docker create returned empty container id"
docker export "$CID" > "$WORKDIR/rootfs.tar"
docker rm "$CID" >/dev/null
[[ -s "$WORKDIR/rootfs.tar" ]] || die "exported rootfs tar is empty"

# 4. mke2fs inside a tooling container so the host doesn't need e2fsprogs.
# The tar is extracted *inside* the container's own filesystem (not the bind
# mount) so macOS Docker's bind-mount permission quirks don't interfere with
# files like usr/share/zoneinfo/right/* that have restrictive permissions.
log "building ext2 image (size=$SIZE) → $OUT_ABS"
# mke2fs writes to a path inside the container's own FS (macOS Docker
# bind-mount permissions can fight us if it writes directly to a host
# bind-mount). After it produces the image, stream it back out via stdout.
docker run --rm -i \
  -v "$WORKDIR":/work:ro \
  debian:bookworm-slim bash -c "
    set -euo pipefail
    apt-get update >/dev/null 2>&1 && apt-get install -y --no-install-recommends e2fsprogs >/dev/null 2>&1
    mkdir -p /tmp/rootfs
    tar -xpf /work/rootfs.tar -C /tmp/rootfs --numeric-owner 2>/dev/null
    mke2fs -t ext2 -d /tmp/rootfs -m 0 -L webvm /tmp/disk.ext2 '$SIZE' >&2
    cat /tmp/disk.ext2
  " > "$OUT_ABS"

[[ -s "$OUT_ABS" ]] || die "ext2 image was not produced"
SIZE_BYTES="$(wc -c < "$OUT_ABS")"
log "done. wrote $OUT_ABS ($SIZE_BYTES bytes)"
