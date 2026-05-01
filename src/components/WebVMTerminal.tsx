import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { loadCheerpX, isCrossOriginIsolated, bootstrapCoi, type CheerpXLinuxInstance } from '../lib/cheerpx-loader.js';

/**
 * Live in-browser Linux terminal for project showcases.
 *
 * Boots a real Linux userland (CheerpX x86-to-WASM JIT) on top of an ext2 disk
 * image streamed over HTTP, wires it to xterm.js, and exposes a sidebar of
 * suggested commands the visitor can click to insert.
 *
 * **Setup the consumer must do** (one-time per showcase site):
 *
 * 1. Install peer deps:
 *
 *        npm install @leaningtech/cheerpx @xterm/xterm @xterm/addon-fit
 *
 * 2. Place coi-serviceworker.js (https://github.com/gzuidhof/coi-serviceworker)
 *    in the site's `public/` directory and reference it from `index.html`:
 *
 *        <script src="coi-serviceworker.js"></script>
 *
 *    Without this, GitHub Pages cannot enable cross-origin isolation and
 *    CheerpX's `SharedArrayBuffer` requirement will fail.
 *
 * 3. Host an ext2 disk image somewhere CheerpX can range-request from.
 *    GitHub Releases works — the showcase-kit `webvm/` pipeline builds and
 *    uploads it from a project-supplied Dockerfile.
 *
 * The component handles everything else: lazy-loads CheerpX and xterm.js,
 * mounts the disk image, runs the boot command, and proxies xterm input/output
 * to the kernel's first virtual terminal.
 */

export interface WebVMDiskImage {
  /** URL of the .ext2 disk image. CheerpX HTTP-range-requests it on demand. */
  url: string;
  /** "cloud" = WebSocket-or-HTTP streaming (default; works on GitHub Releases).
   *  "bytes" = single HTTP fetch with byte ranges.
   *  "github" = direct fetch from a GitHub repo blob. */
  type?: 'cloud' | 'bytes' | 'github';
  /** Friendly name shown in the loading state, e.g. "Debian + ptydriver". */
  label?: string;
  /** IndexedDB cache name for the on-disk overlay. Defaults to a hash of the URL. */
  cacheId?: string;
}

export interface WebVMSuggestedCommand {
  /** Short label the visitor sees in the sidebar. */
  label: string;
  /** The actual command line to insert. The component appends Enter. */
  cmd: string;
  /** Optional one-liner shown under the label. */
  description?: string;
}

export interface WebVMTerminalProps {
  /** Required: the disk image to boot. */
  diskImage: WebVMDiskImage;
  /** Boot executable. Defaults to `/bin/bash`. */
  bootCommand?: string;
  /** Boot args. Defaults to `["--login"]`. */
  bootArgs?: ReadonlyArray<string>;
  /** Initial working directory inside the VM. */
  cwd?: string;
  /** Environment variables. A sane default set is merged in. */
  env?: Record<string, string>;
  /** Terminal columns. Defaults to 100. */
  cols?: number;
  /** Terminal rows. Defaults to 28. */
  rows?: number;
  /** When `auto`, boots on mount. When `manual` (default), shows a "Start"
   *  button so visitors opt into the multi-MB CheerpX download. */
  startMode?: 'auto' | 'manual';
  /** Banner shown above the terminal (e.g. project name + tagline). */
  banner?: ReactNode;
  /** Suggested commands rendered as a clickable sidebar. Click inserts +Enter. */
  suggestedCommands?: ReadonlyArray<WebVMSuggestedCommand>;
  /** Called once after the boot command is running and ready for input. */
  onReady?: () => void;
  /** Optional className on the root. */
  className?: string;
}

const DEFAULT_ENV: Record<string, string> = {
  HOME: '/home/user',
  USER: 'user',
  SHELL: '/bin/bash',
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  TERM: 'xterm-256color',
  LANG: 'en_US.UTF-8',
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

interface XtermLike {
  cols: number;
  rows: number;
  open(host: HTMLElement): void;
  write(data: string | Uint8Array): void;
  onData(cb: (data: string) => void): void;
  focus(): void;
  dispose(): void;
  loadAddon(addon: unknown): void;
  scrollToBottom(): void;
}

function defaultCacheIdFor(url: string): string {
  // [LAW:one-source-of-truth] Cache name is a deterministic function of the URL,
  // so reusing the same image across renders shares the IndexedDB overlay.
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  return `webvm-overlay-${(hash >>> 0).toString(36)}`;
}

export function WebVMTerminal({
  diskImage,
  bootCommand = '/bin/bash',
  bootArgs = ['--login'],
  cwd = '/home/user',
  env,
  cols = 100,
  rows = 28,
  startMode = 'manual',
  banner,
  suggestedCommands,
  onReady,
  className,
}: WebVMTerminalProps) {
  const termHostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XtermLike | null>(null);
  const cxReadFuncRef = useRef<((charCode: number) => void) | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [started, setStarted] = useState<boolean>(startMode === 'auto');

  useEffect(() => {
    if (!started) return;
    let disposed = false;

    async function boot() {
      // [LAW:single-enforcer] COI lifecycle is owned by bootstrapCoi.
      // It self-heals stale service workers from prior deploys/versions and
      // reloads when needed — that reload aborts this boot, the next page
      // load reaches isCrossOriginIsolated() === true.
      await bootstrapCoi();
      if (disposed) return;
      if (!isCrossOriginIsolated()) {
        setPhase({
          kind: 'error',
          message:
            "Cross-origin isolation is not active. The page must load coi-serviceworker.js before this component renders. On a fresh visit you may need to reload once after the service worker installs.",
        });
        return;
      }

      // [LAW:dataflow-not-control-flow] Always: load xterm, then load CheerpX,
      // then mount, then setCustomConsole, then run. Same operations every
      // invocation; failures surface through phase, not branched code paths.
      setPhase({ kind: 'loading', message: 'Loading terminal…' });
      const xtermMod = (await import(/* @vite-ignore */ '@xterm/xterm')) as typeof import('@xterm/xterm');
      const fitMod = (await import(/* @vite-ignore */ '@xterm/addon-fit')) as typeof import('@xterm/addon-fit');
      if (disposed) return;

      const term: XtermLike = new xtermMod.Terminal({
        cols,
        rows,
        cursorBlink: true,
        convertEol: true,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
        },
      }) as unknown as XtermLike;
      const fitAddon = new fitMod.FitAddon();
      term.loadAddon(fitAddon);
      term.open(termHostRef.current!);
      (fitAddon as unknown as { fit(): void }).fit();
      term.focus();
      termRef.current = term;

      setPhase({ kind: 'loading', message: 'Loading CheerpX runtime…' });
      let cx;
      try {
        cx = await loadCheerpX();
      } catch (err) {
        setPhase({ kind: 'error', message: `CheerpX failed to load: ${(err as Error).message}` });
        return;
      }
      if (disposed) return;

      setPhase({
        kind: 'loading',
        message: `Mounting disk image (${diskImage.label ?? 'ext2'})…`,
      });
      let instance: CheerpXLinuxInstance;
      try {
        const baseDevice = await (
          diskImage.type === 'bytes'
            ? cx.HttpBytesDevice.create(diskImage.url)
            : diskImage.type === 'github'
              ? cx.GitHubDevice.create(diskImage.url)
              : cx.CloudDevice.create(diskImage.url)
        );
        const cache = await cx.IDBDevice.create(diskImage.cacheId ?? defaultCacheIdFor(diskImage.url));
        const overlay = await cx.OverlayDevice.create(baseDevice, cache);

        // [LAW:one-source-of-truth] Mount shape matches the canonical
        // leaningtech/webvm config. CheerpX's published .d.ts is narrower
        // than the runtime (no devpts/sys/dev-less mounts), so we cast.
        const mounts = [
          { type: 'ext2', path: '/', dev: overlay },
          { type: 'devs', path: '/dev' },
          { type: 'devpts', path: '/dev/pts' },
          { type: 'proc', path: '/proc' },
          { type: 'sys', path: '/sys' },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instance = await cx.Linux.create({ mounts: mounts as any });
      } catch (err) {
        setPhase({ kind: 'error', message: `Disk image mount failed: ${(err as Error).message}` });
        return;
      }
      if (disposed) return;

      setPhase({ kind: 'loading', message: 'Booting…' });

      // setCustomConsole returns a per-byte stdin function. The write callback
      // receives a Uint8Array and the virtual-terminal index — main TTY is vt 1.
      const cxReadFunc = instance.setCustomConsole(
        (buf: Uint8Array, vt: number) => {
          if (vt !== 1) return;
          term.write(buf);
        },
        term.cols,
        term.rows,
      );
      cxReadFuncRef.current = cxReadFunc;

      term.onData((s: string) => {
        for (let i = 0; i < s.length; i++) cxReadFunc(s.charCodeAt(i));
      });

      const envArr = Object.entries({ ...DEFAULT_ENV, ...(env ?? {}) }).map(([k, v]) => `${k}=${v}`);

      setPhase({ kind: 'ready' });
      onReady?.();

      // Re-spawn boot command if the visitor exits — matches WebVM upstream.
      // Errors propagate through the terminal output; no need to surface here.
      while (!disposed) {
        try {
          await instance.run(bootCommand, [...bootArgs], { env: envArr, cwd, uid: 1000, gid: 1000 });
        } catch (err) {
          term.write(`\r\n\x1b[31m[boot exited: ${(err as Error).message}]\x1b[0m\r\n`);
          break;
        }
      }
    }

    boot();

    return () => {
      disposed = true;
      termRef.current?.dispose();
      termRef.current = null;
      cxReadFuncRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, diskImage.url, diskImage.type]);

  function handleSuggestedClick(cmd: string) {
    const cxRead = cxReadFuncRef.current;
    if (!cxRead) return;
    const data = `${cmd}\r`;
    for (let i = 0; i < data.length; i++) cxRead(data.charCodeAt(i));
    termRef.current?.focus();
  }

  return (
    <div className={['sk-webvm', className].filter(Boolean).join(' ')}>
      {banner ? <div className="sk-webvm-banner">{banner}</div> : null}
      <div className="sk-webvm-body">
        {suggestedCommands && suggestedCommands.length > 0 ? (
          <aside className="sk-webvm-sidebar">
            <p className="sk-webvm-sidebar-eyebrow">Try</p>
            <ul className="sk-webvm-suggestions">
              {suggestedCommands.map((s) => (
                <li key={s.label}>
                  <button
                    type="button"
                    className="sk-webvm-suggestion"
                    onClick={() => handleSuggestedClick(s.cmd)}
                    disabled={phase.kind !== 'ready'}
                  >
                    <span className="sk-webvm-suggestion-label">{s.label}</span>
                    {s.description ? (
                      <span className="sk-webvm-suggestion-desc">{s.description}</span>
                    ) : null}
                    <code className="sk-webvm-suggestion-cmd">{s.cmd}</code>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
        <div className="sk-webvm-stage">
          <div className="sk-webvm-terminal" ref={termHostRef} />
          {phase.kind !== 'ready' ? (
            <div className="sk-webvm-overlay">
              {phase.kind === 'idle' ? (
                <button
                  type="button"
                  className="sk-webvm-start"
                  onClick={() => setStarted(true)}
                >
                  <span>Start Linux</span>
                  <small>boots a real Linux userland in your browser (~few MB)</small>
                </button>
              ) : phase.kind === 'loading' ? (
                <div className="sk-webvm-loading">
                  <div className="sk-webvm-spinner" aria-hidden />
                  <p>{phase.message}</p>
                </div>
              ) : (
                <div className="sk-webvm-error">
                  <p className="sk-webvm-error-title">Couldn't start the VM</p>
                  <p className="sk-webvm-error-msg">{phase.message}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
