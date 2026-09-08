import { test, expect } from "@playwright/test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

for (const mode of ["legacy", "auto"]) {
  test(`official MCP client discovers and uses tools, resources, and prompts (${mode})`, async ({ baseURL, request }) => {
    const client = new Client({ name: "augmentic-test", version: "1.0.0" }, { versionNegotiation: { mode } });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", baseURL)));
      expect(client.getServerVersion().name).toBe("augmentic-accounting");
      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name)).toEqual(["search_articles"]);
      const found = await client.callTool({ name: "search_articles", arguments: { query: "  VIDEOS  ", limit: 1 } });
      expect(found.isError).not.toBe(true);
      const [article] = found.structuredContent.articles;
      expect(article.id).toBe("2026/09/ai-videos-for-accountants");
      expect(article.url).toBe(`https://augmenticaccounting.com/articles/${article.id}`);
      expect(found.structuredContent.articles).toHaveLength(1);
      const resources = (await client.listResources()).resources;
      const catalog = await (await request.get("/static/data/articles.json")).json();
      expect(resources.map(resource => resource.uri).sort()).toEqual(catalog.map(article => article.resourceUri).sort());
      for (const resource of resources) {
        const read = await client.readResource({ uri: resource.uri });
        expect(read.contents[0].mimeType).toBe("text/markdown");
        expect(read.contents[0].text).toBe(catalog.find(article => article.resourceUri === resource.uri).markdown);
      }
      expect((await client.listPrompts()).prompts.map(prompt => prompt.name)).toEqual(["plan_ai_learning_session"]);
      const prompt = await client.getPrompt({ name: "plan_ai_learning_session", arguments: { audience: "accounting managers", topic: "videos" } });
      expect(prompt.messages[0].content.text).toContain("30-minute AI learning session for accounting managers about videos");
      const sources = prompt.messages.filter(message => message.content.type === "resource");
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.length).toBeLessThanOrEqual(3);
      expect(sources[0].content.resource.uri).toBe(article.resourceUri);
      const empty = await client.callTool({ name: "search_articles", arguments: { query: "zzzzunmatchedtopic" } });
      expect(empty.structuredContent).toMatchObject({ total: 0, articles: [] });
      const noSources = await client.getPrompt({ name: "plan_ai_learning_session", arguments: { audience: "accountants", topic: "zzzzunmatchedtopic" } });
      expect(noSources.messages).toHaveLength(1);
      expect(noSources.messages[0].content.text).toContain("No published articles matched");
      await expect(client.readResource({ uri: "augmentic://articles/nonexistent" })).rejects.toThrow();
    } finally {
      await client.close();
    }
  });
}

async function envelope(response) {
  const raw = await response.text();
  if (!response.headers()["content-type"]?.includes("text/event-stream")) return JSON.parse(raw);
  return raw.split(/\r?\n/u).filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5))).find(message => message.id === 1);
}

async function rpc(request, method, params, headers = {}) {
  return request.post("/mcp", {
    headers: { Accept: "application/json, text/event-stream", ...headers },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
}

test("Cloudflare bridge can list and call tools without a session or initialize", async ({ request, baseURL }) => {
  const response = await rpc(request, "tools/list", {}, { Origin: baseURL });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/application\/json|text\/event-stream/);
  expect((await envelope(response)).result.tools[0].name).toBe("search_articles");
  const called = await rpc(request, "tools/call", { name: "search_articles", arguments: { query: "reconciliation" } });
  expect((await envelope(called)).result.structuredContent.total).toBeGreaterThan(0);
  for (const args of [{ query: " " }, { query: "x".repeat(201) }, { query: "videos", limit: 21 }, { query: "videos", limit: 1.5 }]) {
    const result = await envelope(await rpc(request, "tools/call", { name: "search_articles", arguments: args }));
    expect(Boolean(result.error || result.result?.isError)).toBe(true);
  }
  const rejected = await rpc(request, "tools/list", {}, { Origin: "https://unrelated.example" });
  expect(rejected.status()).toBe(403);
});

test("Worker preserves static pages, sitemap, robots, and missing-page behavior", async ({ request }) => {
  for (const route of ["/", "/resources", "/agent-demo", "/articles/2026/09/ai-videos-for-accountants"]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("xml");
  expect(await sitemap.text()).toContain("<loc>https://augmenticaccounting.com/agent-demo</loc>");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://augmenticaccounting.com/sitemap.xml");
  expect((await request.get("/a-page-that-does-not-exist")).status()).toBe(404);
  expect((await request.get("/mcp")).status()).toBe(405);
});
