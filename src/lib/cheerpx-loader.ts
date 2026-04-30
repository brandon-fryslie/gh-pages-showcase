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
