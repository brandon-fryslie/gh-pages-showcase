# showcase-kit / webvm / cf-worker

Cloudflare Worker that re-fronts GitHub Releases assets with the CORS and
CORP headers that a cross-origin-isolated CheerpX page requires.

## Why this exists

`<WebVMTerminal>` runs in a `coi-serviceworker`-isolated page. In that
context the browser only delivers cross-origin responses that include
`Cross-Origin-Resource-Policy: cross-origin`. GitHub Releases redirect to
`release-assets.githubusercontent.com` and that server returns *no* CORP
header — so CheerpX can't fetch the disk image directly. This Worker is
the smallest reasonable hop that adds the missing headers without taking
ownership of the bytes.

## Surface

```
GET  https://<worker-host>/<owner>/<repo>/releases/download/<tag>/<asset>
HEAD https://<worker-host>/<owner>/<repo>/releases/download/<tag>/<asset>
OPTIONS [...]
```

The path is *exactly* the GitHub path under `github.com/`. Range requests
are passed through, so CheerpX's chunk-by-chunk disk-image fetch works.

Responses include:

- `access-control-allow-origin: *`
- `cross-origin-resource-policy: cross-origin`
- whatever upstream returned for `content-length`, `accept-ranges`, etc.

## One-time deploy

```sh
cd webvm/cf-worker
wrangler login            # opens a browser; OAuth to your Cloudflare account
wrangler deploy           # publishes to <name>.<account>.workers.dev
```

The deployed URL (`https://webvm.tinkerpad.ai`) is the new `diskImage.url`
prefix for every project's `<WebVMTerminal>`:

```diff
- url: 'https://github.com/brandon-fryslie/ptydriver/releases/download/webvm-image-v1/ptydriver.ext2',
+ url: 'https://webvm.tinkerpad.ai/brandon-fryslie/ptydriver/releases/download/webvm-image-v1/ptydriver.ext2',
```

One Worker handles every project.

## Cost

Cloudflare Workers free plan: 100k requests/day. Each visitor's CheerpX
session ranges-fetches O(disk_image_size / block_size) requests — roughly
a few thousand for a fully-explored 500MB image, far less for typical
visits. Free plan covers thousands of visitors/day comfortably.

## Why not stream from a custom origin?

R2 (Cloudflare's S3) is the natural alternative — set CORS on the bucket
and skip the Worker entirely. Trade-off: every project needs to upload
its image into R2, doubling storage; whereas the Worker stays at zero
storage cost and just relays the bytes GitHub already hosts.
