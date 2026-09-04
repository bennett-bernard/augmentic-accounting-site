# Augmentic Accounting site

The site is authored with FastAPI, Jinja templates, and Markdown, then rendered
to static HTML and deployed through Cloudflare Workers Static Assets.

## Local setup

```powershell
uv sync --locked
npm.cmd ci
```

## Build and test

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd run deploy:dry-run
```

Run a local Cloudflare preview with:

```powershell
npm.cmd run dev
```

Then open `http://localhost:8787`. Press `Ctrl+C` to stop the preview.

## Deploy

```powershell
npm.cmd run deploy
```

The production custom domain is `https://augmenticaccounting.com`. Cloudflare
redirects `www.augmenticaccounting.com` to the apex domain.

## Publish an article

1. Add the Markdown file under `articles/<year>/<month>/`.
2. Run the tests and local preview.
3. Commit the Markdown source and any intentional template or asset changes.
4. Deploy with `npm.cmd run deploy`.

`dist/`, `.venv/`, `node_modules/`, and `.wrangler/` are generated locally and
must not be committed.

### AI video companion page

The page source is `articles/2026/09/ai-videos-for-accountants.md`. Its
`layout: video-companion` selects the dedicated video template while other
articles continue using the standard template. Both original example MP4s and
their poster images are in `static/video/ai-videos-for-accountants/`.

The walkthrough is awaiting upload. Before publishing this page, set
`youtube_id` to the uploaded video's 11-character ID (not its full URL), run the
tests/build, and check the player. An empty ID shows an honest coming-soon
caption with no broken embed. Once set, the thumbnail opens a privacy-enhanced
YouTube embed on click; the link also works with JavaScript disabled.

The portrait videos load on demand, start muted, and retain their original
audio for visitors to enable. Their download links serve the original files.
