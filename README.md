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
