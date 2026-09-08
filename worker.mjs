import { createMcpHandler } from "agents/mcp/server";
import { createServer } from "./server/mcp.mjs";

const hosts = ["augmenticaccounting.com", "localhost", "127.0.0.1", "[::1]"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/mcp") return env.ASSETS.fetch(request);

    // A fresh SDK server per request supports ordinary MCP clients and the
    // Cloudflare bridge's direct tools/list and tools/call requests.
    const handler = createMcpHandler(async () => {
      const response = await env.ASSETS.fetch(new URL("/static/data/articles.json", url));
      if (!response.ok) throw new Error("Published article index is unavailable. Run npm run build before deploying.");
      return createServer(await response.json());
    }, {
      route: "/mcp",
      legacy: "stateless",
      responseMode: "auto",
      allowedHostnames: hosts,
      allowedOriginHostnames: hosts,
    });
    return handler(request, env, ctx);
  },
};
