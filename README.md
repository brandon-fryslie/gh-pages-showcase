# showcase-kit

Composable React components for project showcase pages on GitHub Pages.

## What it is

A small set of components that handle the parts every showcase page tends to need — the metadata footer, the headline, code blocks, an Apple-style scroll-pinned hero — without owning your page structure. Your `App.tsx` composes them however you want; the library never calls back into your page.

## What it isn't

Not a templating engine. Not a JSON-driven page generator. Not a starter that needs configuring through a schema. There is no `hero.kind` discriminator. If a project's showcase wants a shape this library doesn't anticipate, write that shape in your `App.tsx` — the library doesn't fight you.

## Components

- **`<Header>`** — eyebrow, name, tagline, badges, optional CTA actions.
- **`<MetadataFooter>`** — github link, license, install one-liner, language tag, additional named links.
- **`<CodeBlock>`** — styled `<pre><code>` with an optional language hint. No syntax highlighting; bring your own if you want it.
- **`<ScrollPin>`** — soft-locks its children into the viewport while the user scrolls past. Lenis (smooth/inertial scroll) + GSAP ScrollTrigger (pin + scrub). Card animates from windowed to fullscreen on engage; holds; releases.

## Usage

```sh
# git-installable while iterating
npm install github:brandon-fryslie/gh-pages-showcase react react-dom gsap lenis
```

```tsx
import { Header, ScrollPin, MetadataFooter } from 'showcase-kit';
import 'showcase-kit/styles.css';
import { MyDemo } from './MyDemo';

export function App() {
  return (
    <>
      <Header
        eyebrow="an experiment by brandon-fryslie"
        name="electric-cherry"
        tagline="Electron debugging MCP server: one tool surface for both halves."
        badges={['MCP server', 'CDP + V8 Inspector', '30 tools']}
      />
      <ScrollPin>
        <MyDemo />
      </ScrollPin>
      <MetadataFooter
        github="https://github.com/brandon-fryslie/electric-cherry"
        license="MIT"
        language="TypeScript"
        install="npm install electric-cherry"
      />
    </>
  );
}
```

## Build

```sh
npm install
npm run build   # → dist/index.js, dist/showcase-kit.css, dist/index.d.ts
```

## License

MIT
