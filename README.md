# Vipul Ojha — personal portfolio

An original static portfolio inspired by the phone-shaped navigation of
https://www.raffi.town/. A warm illustrated home screen opens functional profile,
project, toolkit, and contact panels beside the phone. The phone also works on
mobile. HTML, CSS, and a small JavaScript file: no framework, build step, analytics,
prerecorded app videos, or production dependencies.

Content is based on the public https://github.com/vipulojha profile, profile README,
and repository metadata reviewed on October 5, 2026. The ohman repository is labeled
as a fork. Project illustrations are decorative, not screenshots. No experience,
live status, Spotify activity, or qualifications are invented.

## Preview

From this directory:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173/. Without JavaScript, all profile and project details
appear in an ordinary document and navigation uses native anchors. JavaScript adds
phone sheets, deep-linked panels, theme persistence, project filters, and email
copying. Escape, the back arrow, and the home indicator return to the home screen.

This redesign is local only until separately approved for publication. Starting
the preview does not deploy or change the existing live site.

## Checks

```bash
node --check app.js
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/smoke.cjs
```

Keep the preview server running for the browser check. Set `SITE_URL` to test another
address. Set `PLAYWRIGHT_MODULE` to an existing test-only Playwright installation
instead of installing it in this repository. The shared coordination board tracks
the actual checks and the regression-suite handoff for this redesign; do not count
old-design assertions as proof of the new interaction contract. Browser checks
generate ignored `preview-*.png` screenshots. Clipboard behavior uses test stubs;
a real browser still requires permission and a secure context.

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
- `app.js`: panel/phone navigation, theme, filters, and clipboard behavior.
- `assets/avatar.png`: public GitHub avatar snapshot.
- `social-card.svg` and `assets/social-card.png`: editable share graphic and its
  browser-compatible PNG export. Regenerate the PNG if the graphic changes.

## Reference analysis

The reference uses plain HTML/CSS/JavaScript, a screenshot with clickable hotspots,
and prerecorded app videos. This portfolio instead renders an original home screen
and functional content with native elements. It uses no reference media, identity,
or application code, and does not pretend to run iOS apps or show live activity.
The source-based analysis is recorded in workspace-root
`reports/raffi-town-analysis.md`; coordination and current verification evidence
are in `coordination.md`. Reference mobile rendering was checked live; desktop
interactions remain unverified because the built-in browser panel was too narrow.
