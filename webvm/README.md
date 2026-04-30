# showcase-kit / webvm

Generalizable pipeline for running a real Linux userland inside a project
showcase via [CheerpX](https://cheerpx.io/) and [`<WebVMTerminal>`](../src/components/WebVMTerminal.tsx).

This directory is a **toolbox**, not a framework. A project's showcase opts in
by adopting the four files below; nothing in showcase-kit forces a project
to use it.

## What's in here

| File                | Role                                                                         |
|---------------------|------------------------------------------------------------------------------|
| `Dockerfile.base`   | Common rootfs (Debian + `user@1000` + bash + locale). Projects FROM this.    |
| `build-image.sh`    | Build pipeline: project Dockerfile → ext2 disk image. Runs mke2fs in-container. |
| `upload-image.sh`   | Push the ext2 to a GitHub Release on the project's repo. Idempotent.         |
| `setup-coi.sh`      | One-shot: drops `coi-serviceworker.js` into a Vite `public/` dir.            |

## Why each piece exists

- **CheerpX needs SharedArrayBuffer**, which needs cross-origin isolation
  (`COOP: same-origin` + `COEP: require-corp`). GitHub Pages can't set headers,
  so we register `coi-serviceworker` from upstream — that SW intercepts every
  response and adds the headers. `setup-coi.sh` puts the file where Vite ships
  it.
- **CheerpX boots an ext2 image** via `CloudDevice` (HTTP range requests). The
  image lives on a GitHub Release on the project's own repo: one canonical
  hosting location per project, no third-party CDN dependency.
- **The base Dockerfile** standardizes the userland so `<WebVMTerminal>`'s
  `run("/bin/bash", ["--login"], { uid: 1000, gid: 1000, cwd: "/home/user" })`
  call works without per-project tweaks.

## End-to-end recipe (per project)

A project consuming this pipeline lives like:

```
my-project/
  showcase/                 # Vite app published as gh-pages
    index.html              # contains <script src="coi-serviceworker.js"></script>
    public/
      coi-serviceworker.js  # produced by setup-coi.sh
    src/
      App.tsx               # composes <WebVMTerminal>
    webvm/
      Dockerfile            # FROM showcase-kit-webvm-base + project install
      release-notes.md      # (optional) published with the GH release
```

### 1. One-time per repo

```sh
# In the project's showcase/ directory
mkdir -p public
~/code/gh-pages-showcase/webvm/setup-coi.sh public
```

Then add to `index.html`:

```html
<script src="coi-serviceworker.js"></script>
```

### 2. Write the project's Dockerfile

`showcase/webvm/Dockerfile`:

```dockerfile
FROM showcase-kit-webvm-base:latest
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*
USER user
RUN python3 -m venv /home/user/.venv && \
    /home/user/.venv/bin/pip install --no-cache-dir my-project
ENV PATH=/home/user/.venv/bin:$PATH
```

### 3. Build the disk image

```sh
~/code/gh-pages-showcase/webvm/build-image.sh \
  --base-tag showcase-kit-webvm-base:latest \
  --dockerfile showcase/webvm/Dockerfile \
  --out /tmp/my-project.ext2 \
  --size 1G
```

`--base-tag` ensures the base image is built from `Dockerfile.base` first.
After the first build, omit it to skip rebuilding.

### 4. Upload to a GitHub Release

```sh
~/code/gh-pages-showcase/webvm/upload-image.sh \
  --image /tmp/my-project.ext2 \
  --repo brandon-fryslie/my-project \
  --tag webvm-image-v1
```

Output prints the URL to feed into `<WebVMTerminal>`'s `diskImage.url`.

### 5. Wire into the showcase

```tsx
import { WebVMTerminal } from 'showcase-kit';

<WebVMTerminal
  diskImage={{
    url: 'https://github.com/brandon-fryslie/my-project/releases/download/webvm-image-v1/my-project.ext2',
    label: 'Debian + my-project',
  }}
  bootCommand="/bin/bash"
  bootArgs={['--login']}
  suggestedCommands={[
    { label: 'Run demo', cmd: 'my-project --help' },
  ]}
/>
```

## Image sizing

CheerpX downloads the image lazily in chunks, so total image size is less
critical than typical CDN concerns — but bigger images cost more bandwidth
on first interactive use. Reasonable targets:

- Base + small CLI in Python: **~250 MB**
- Base + Node toolchain: **~400 MB**
- Base + heavy graphical stack: **~1 GB**

GitHub Releases allow assets up to 2 GB.

## Iterating on a project image

When debugging the rootfs, run it locally before building the ext2:

```sh
docker run --rm -it -u user webvm-rootfs:latest /bin/bash --login
```

That same image is what gets exported. If it works under Docker it'll boot
in CheerpX.

## License notes

CheerpX is **free for non-commercial use** with attribution. Personal /
educational / open-source showcases qualify; commercial deployments need a
license from Leaning Technologies. Consult
<https://cheerpx.io/legal/license> before pointing this pipeline at a
commercial project.
