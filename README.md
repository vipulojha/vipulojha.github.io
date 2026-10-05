# Vipul Ojha — personal portfolio

An original static portfolio inspired by the expressive rounded shapes, bold type,
grid background, and pill navigation of https://yasakei.dev/. HTML, CSS, and a small
JavaScript file: no framework, build step, analytics, or production dependencies.

Content is based on the public https://github.com/vipulojha profile, profile README,
and repository metadata reviewed on October 5, 2026. The ohman repository is labeled
as a fork. Project illustrations are decorative, not screenshots. No experience,
live status, Spotify activity, or qualifications are invented.

## Preview

From this directory:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173/. All projects and navigation work without JavaScript.
JavaScript adds theme persistence, project filters, a mobile menu, and email copying.

## Checks

```bash
node --check app.js
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/smoke.cjs
```

Keep the preview server running for the browser check. Set `SITE_URL` to test another
address. The smoke check covers project filtering, light/dark persistence, blocked
storage, clipboard success/failure, mobile menu and Escape, native anchors, no-JS
fallback, and no horizontal overflow at 13 viewport widths from 320 to 1440 pixels. It generates
ignored desktop/mobile screenshots. Clipboard behavior uses test stubs; a real
browser still requires permission and a secure context.

## Publish to GitHub Pages

The deployment repository is `vipulojha/vipulojha.github.io`, giving the address
https://vipulojha.github.io/ after a successful deployment. GitHub authentication
is required for initial setup and publishing changes.

1. Authenticate with `gh auth login --hostname github.com --git-protocol https --web`.
2. Initialize this folder as a Git repository with a `main` branch. Confirm the
   local commit identity and commit these site files.
3. Create the public `vipulojha/vipulojha.github.io` repository. If it exists by then,
   inspect it first rather than overwrite unrelated work.
4. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source.
5. Push `main`. The included `.github/workflows/pages.yml` deploys the site. If the
   first run happened before Pages was enabled, rerun the failed workflow.
6. Verify the Actions deployment and the live site before claiming it is published.

The workflow stages only `index.html`, `styles.css`, `app.js`, `favicon.svg`,
`social-card.svg`, `.nojekyll`, and `assets/`. Tests, documentation, previews, and
local configuration are not included in the published artifact.

## Edit

- `index.html`: profile copy, email, project links, and metadata.
- `styles.css`: colors, responsive layouts, and reduced-motion styling.
- `app.js`: theme, menu, filters, and clipboard behavior.
- `assets/avatar.png`: public GitHub avatar snapshot.
- `social-card.svg` and `assets/social-card.png`: editable share graphic and its
  browser-compatible PNG export. Regenerate the PNG if the graphic changes.

## Reference analysis

The reference's publicly delivered HTML, CSS, and JavaScript indicate a React site
using Framer Motion and Material-style color tokens, asymmetric rounded cards,
anchor sections, project cards, and tech-stack tiles. Its theme can derive from
Spotify cover art, and content/status use its own APIs. This portfolio recreates
the broad visual language with original code and content. It does not reuse the
reference's assets, bundled application code, identity, or private integrations.
The reference analysis was source-based; interactive inspection in the built-in
browser was blocked by pending website-access approval.
