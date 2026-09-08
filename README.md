# Augmentic Accounting site

The site is authored with FastAPI, Jinja templates, and Markdown, then rendered
to static HTML and deployed through Cloudflare Workers Static Assets. A small
Worker also serves the public MCP endpoint.

## Local setup

```powershell
uv sync --locked
npm.cmd ci
npx.cmd playwright install chromium
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

### Sitemap

Every build generates `dist/sitemap.xml` from the same routes used to render
public pages, including article archives and individual articles. URLs use the
canonical `https://augmenticaccounting.com` domain. The build also generates
`dist/robots.txt` with `Sitemap: https://augmenticaccounting.com/sitemap.xml`.

Adding or deleting article Markdown files updates the sitemap on the next
build and deployment; no separate URL list needs maintenance. New static page
routes in `main.py` are discovered automatically. Preview both files at
`http://localhost:8787/sitemap.xml` and `http://localhost:8787/robots.txt` using
`npm.cmd run dev`.

After deploying, validate the live site:

```sh
curl -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://augmenticaccounting.com"}'
```

The response should report `checks.discoverability.sitemap.status` as `"pass"`.

### AI video companion page

The page source is `articles/2026/09/ai-videos-for-accountants.md`. Its
`layout: video-companion` selects the dedicated video template while other
articles continue using the standard template. Both original example MP4s and
their poster images are in `static/video/ai-videos-for-accountants/`.

The page can be published with the examples while the walkthrough is awaiting
upload. An empty `youtube_id` shows a coming-soon caption with no broken embed.
When the walkthrough is available, set `youtube_id` to its 11-character ID
(not its full URL), run the tests/build, check the actual player, and redeploy.
Once set, the thumbnail opens a privacy-enhanced YouTube embed on click; the
link also works with JavaScript disabled.

The portrait videos load on demand, start muted, and retain their original
audio for visitors to enable. Their download links serve the original files.

## MCP server and WebMCP demo

`/agent-demo` is linked from Resources. It demonstrates an actual MCP server
at `/mcp` plus two native WebMCP tools in the browser. All server operations
use public articles; no authentication, model API key, or database is needed.

| Interface | Name | Behavior |
| --- | --- | --- |
| MCP tool | `search_articles` | Searches article titles, excerpts, tags, and Markdown. Accepts `query` and optional `limit` (1–20, default 5). Returns canonical links and resource URIs. |
| MCP resources | `augmentic://articles/<year>/<month>/<slug>` | One readable Markdown resource for every published article. Use `resources/list`, then `resources/read`. |
| MCP prompt | `plan_ai_learning_session` | Accepts `audience` and `topic`; returns instructions for a 30-minute learning session and up to three matching article resources. The client's model generates the lesson. |
| Declarative WebMCP | `demo_find_articles` | Native HTML form annotations let an agent fill search words. The visitor clicks **Search articles**; `respondWith()` returns the results to the agent. |
| Imperative WebMCP | `demo_preview_article` | A registered JavaScript function takes `articleId`, shows and focuses its preview, highlights a matching result, and returns article details. |

The build generates `dist/static/data/articles.json` from
`articles/<year>/<month>/*.md`, using `site_content.py`. That directory is the
site's published content tree; keep drafts elsewhere. Adding or removing an
article updates the demo, resource list, searches, prompt sources, and sitemap
on the next build and deployment.

The Worker serves `/mcp` using Cloudflare's stateless MCP handler and delegates
page delivery to the `ASSETS` binding. The server supports standard MCP client
initialization and the Cloudflare bridge's direct `tools/list` and `tools/call`
requests. Legacy responses use SSE; the demo client also accepts JSON. No
Durable Object or persistent session is required.

### Run the demo

```sh
npm run dev
```

Open `http://localhost:8787/agent-demo`. The page's controls work in an ordinary
browser. Use the three server cards to see search results, article Markdown,
and the prepared prompt. Search and preview in the browser section to see the
page and activity log update.

For an external MCP client or MCP Inspector, select **Streamable HTTP** and
connect to `http://localhost:8787/mcp` (or
`https://augmenticaccounting.com/mcp` after deployment). No bearer token is
required. For a quick bridge-compatible request:

```sh
curl -N http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_articles","arguments":{"query":"videos","limit":3}}}'
```

To try native WebMCP, follow [Chrome's WebMCP setup instructions](https://developer.chrome.com/docs/ai/webmcp)
and open the demo in that browser. With the testing API enabled, these DevTools
snippets discover and execute the real tools:

```js
const tools = await document.modelContext.getTools();
const search = tools.find(tool => tool.name === "demo_find_articles");
const pending = document.modelContext.executeTool(search, '{"query":"videos"}');
// Click Search articles on the page; the tool stays pending until submission.
const results = JSON.parse(await pending);
const preview = tools.find(tool => tool.name === "demo_preview_article");
await document.modelContext.executeTool(preview, JSON.stringify({
  articleId: results.articles[0].id,
}));
```

The browser implementation uses `document.modelContext` and falls back to
`navigator.modelContext` for older implementations. WebMCP is experimental;
registration is feature-detected and the normal controls remain usable when
it is unavailable. Native form annotations and JavaScript registration are
separate examples. The demo does not install a polyfill.

Cloudflare's injected `/.webmcp/bridge.js`, with
`data-packs="c2pa,mcp-server-client"`, discovers `/mcp` automatically. It adds the
server's `search_articles` tool alongside the page's two `demo_` tools. It does
not expose the MCP resources or prompts through WebMCP. Local Wrangler preview
does not inject this Cloudflare edge script.

### Validate changes

Install the browser once, then run the complete suite:

```sh
npx playwright install --with-deps chromium
npm test
npm run deploy:dry-run
```

Python tests check the static build, sitemap, and publication/removal behavior.
Playwright starts a local Worker on port 8792 and tests the official MCP client
in legacy and automatic protocol modes, direct bridge requests, all demo
controls, mobile layout, and actual native WebMCP tool calls in Chromium with
the experimental flags enabled. Run only integration checks with
`npm run test:integration`. Stop a running preview before rebuilding and restart
it afterward so Wrangler reloads the generated asset tree cleanly.

To add more server tools or prompts, register them in `server/mcp.mjs`; add
shared article behavior to `static/js/article-catalog.mjs`. Keep browser-only
UI operations in `static/js/agent-demo.mjs`. If the MCP endpoint is deployed
under another hostname, update the allowed hostname/origin lists in
`worker.mjs` and the canonical domain in `site_content.py` before deploying.
