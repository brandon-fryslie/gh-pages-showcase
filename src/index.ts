/**
 * showcase-kit — composable React components for project showcase pages.
 *
 * Consumers import the components and the bundled stylesheet:
 *
 *     import { ScrollPin, Header, MetadataFooter, CodeBlock } from "showcase-kit";
 *     import "showcase-kit/styles.css";
 *
 * Then compose the page in their own JSX. Each component is independent —
 * use any subset; the library never owns your page structure.
 */

export { ScrollPin } from './components/ScrollPin.js';
export type { ScrollPinProps } from './components/ScrollPin.js';

export { Header } from './components/Header.js';
export type { HeaderProps } from './components/Header.js';

export { MetadataFooter } from './components/MetadataFooter.js';
export type { MetadataFooterProps, MetadataLink } from './components/MetadataFooter.js';

export { CodeBlock } from './components/CodeBlock.js';
export type { CodeBlockProps } from './components/CodeBlock.js';

export { WebVMTerminal } from './components/WebVMTerminal.js';
export type {
  WebVMTerminalProps,
  WebVMDiskImage,
  WebVMSuggestedCommand,
} from './components/WebVMTerminal.js';
export { isCrossOriginIsolated } from './lib/cheerpx-loader.js';

// Side-effect import so the bundled CSS gets emitted alongside the JS.
import './styles/index.css';
