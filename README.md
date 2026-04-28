# gh-pages-showcase

A drop-in static site template for any GitHub Pages-deployed repo.
Copy four files, fill in a JSON, push. Get a polished project page with
zero build step.

Designed to pair with [gh-pages-multiplexer](https://github.com/brandon-fryslie/gh-pages-multiplexer)
but works with any Pages source (branch, action, manual upload).

## What you get

A single-page site with:

- **Hero** — project name, tagline, primary CTA, language/license/custom badges
- **Visual** — image, video, iframe (live demo), or syntax-highlighted code block
- **Highlights** — 3–6 cards explaining what's interesting about the project
- **Quickstart** — copy-paste shell commands in a code block
- **Screenshots** — gallery with captions
- **Links** — pill grid of secondary destinations (docs, blog post, related repos)

Sections with no data hide themselves. The minimum viable showcase is just
`project.name` + `project.tagline`.

## Installing into your repo

```sh
# from inside the repo you want to add Pages to
mkdir -p docs
cp -r /path/to/gh-pages-showcase/template/. ./docs/
mv ./docs/showcase.example.json ./docs/showcase.json
$EDITOR ./docs/showcase.json
git add docs/ && git commit -m 'Add showcase site' && git push

# enable Pages: Settings → Pages → Source: branch master, folder /docs
```

If you're using `gh-pages-multiplexer`, drop the four `template/` files into
the source directory the multiplexer deploys instead — the same JSON drives
each versioned deploy.

## File contract

```
your-repo/docs/
├── index.html      ← from template/, do not edit per project
├── style.css       ← from template/, do not edit per project (override via CSS vars)
├── main.js         ← from template/, do not edit per project
├── showcase.json   ← per-project data — this is what you write
└── (assets: screenshots, hero image, etc.)
```

`index.html`, `style.css`, and `main.js` are intentionally project-agnostic.
They never need to change per-repo. Every project-specific thing lives in
`showcase.json`. When the template improves upstream, you re-copy those
three files and your customizations stay safe.

## Theme

Default palette is dark with a sandstone accent. Override via CSS variables
on `:root`:

```css
:root {
  --bg: #0d1117;
  --accent: #d8b89a;
  --link: #79b8ff;
  /* etc. — see template/style.css for the full set */
}
```

Drop a `theme.css` next to `style.css` and add `<link rel="stylesheet" href="theme.css">`
to `index.html` after the existing stylesheet to keep your overrides separate
from the upstream.

## License

MIT — see [LICENSE](./LICENSE).
