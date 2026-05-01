// [LAW:one-source-of-truth] CheerpX is a peer dependency. Consumers install
// `@leaningtech/cheerpx` themselves; we dynamic-import it so showcase-kit
// stays lightweight for consumers that don't use <WebVMTerminal>.

import type * as CheerpXNS from '@leaningtech/cheerpx';

export type CheerpXModule = typeof CheerpXNS;
export type CheerpXLinuxInstance = CheerpXNS.Linux;

let modulePromise: Promise<CheerpXModule> | null = null;

/** Dynamic-import `@leaningtech/cheerpx`. Cached so multiple <WebVMTerminal />
 *  instances share one module load. */
export function loadCheerpX(): Promise<CheerpXModule> {
  if (!modulePromise) {
    modulePromise = import(/* @vite-ignore */ '@leaningtech/cheerpx');
  }
  return modulePromise;
}

/** True when SharedArrayBuffer is available — i.e. cross-origin isolation is
 *  active. CheerpX's WASM JIT requires this. On GitHub Pages, isolation comes
 *  from coi-serviceworker.js loaded at page entry; without it, this returns
 *  false and the component should refuse to boot. */
export function isCrossOriginIsolated(): boolean {
  return (
    typeof SharedArrayBuffer !== 'undefined' &&
    typeof crossOriginIsolated !== 'undefined' &&
    crossOriginIsolated === true
  );
}

const COI_RESET_FLAG = 'showcase-kit:coi-sw-reset';

export interface BootstrapCoiOptions {
  /** Override the reload action (tests). Defaults to `window.location.reload()`. */
  reload?: () => void;
}

/**
 * Self-heal cross-origin isolation when a stale `coi-serviceworker.js` from a
 * prior deploy (or another version subdirectory) is preventing the current
 * page from going cross-origin-isolated.
 *
 * Call this once, as early as possible in the page bootstrap, before any
 * CheerpX/SharedArrayBuffer-dependent code. If COI is already active it's a
 * no-op. Otherwise it unregisters any service worker whose scriptURL ends in
 * `/coi-serviceworker.js`, sets a one-shot session flag, and reloads. The
 * flag prevents a reload-loop when nothing useful gets unregistered.
 *
 * Returns a Promise that resolves to `true` when COI is (or becomes) active
 * after this call, `false` when self-heal had nothing to do but COI is still
 * not active (caller should display a fallback UI).
 *
 * [LAW:single-enforcer] COI lifecycle is owned here. Components must not
 * unregister service workers themselves; they consume the result via
 * `isCrossOriginIsolated()`.
 *
 * [LAW:dataflow-not-control-flow] The decision to reload is derived from
 * browser-owned state (`crossOriginIsolated`) plus a session-scoped one-shot
 * flag — not from ad-hoc retry counters scattered across callers.
 */
export async function bootstrapCoi(options: BootstrapCoiOptions = {}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (isCrossOriginIsolated()) {
    window.sessionStorage?.removeItem(COI_RESET_FLAG);
    return true;
  }

  const session = window.sessionStorage;
  if (session?.getItem(COI_RESET_FLAG) === '1') return false;

  if (!('serviceWorker' in navigator)) return false;

  const regs = await navigator.serviceWorker.getRegistrations();
  const stale = regs.filter((r) => {
    const url = r.active?.scriptURL ?? r.waiting?.scriptURL ?? r.installing?.scriptURL ?? '';
    return url.endsWith('/coi-serviceworker.js');
  });

  if (stale.length === 0) return false;

  session?.setItem(COI_RESET_FLAG, '1');
  const results = await Promise.all(stale.map((r) => r.unregister()));
  const unregistered = results.some(Boolean);

  if (!unregistered) {
    session?.removeItem(COI_RESET_FLAG);
    return false;
  }

  (options.reload ?? (() => window.location.reload()))();
  return false;
}
