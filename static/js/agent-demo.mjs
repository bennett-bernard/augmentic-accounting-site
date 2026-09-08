import { searchArticles, summarizeArticle } from "./article-catalog.mjs";

const $ = selector => document.querySelector(selector);
const endpoint = new URL("/mcp", location.origin).href;
$("#mcp-endpoint").textContent = endpoint;
$("#copy-endpoint").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(endpoint);
    $("#copy-status").textContent = "Endpoint URL copied.";
    $("#copy-endpoint").textContent = "Copied";
  } catch {
    $("#copy-status").textContent = "Copy unavailable. Select the endpoint URL to copy it.";
  }
});

function record(message) {
  $("#activity-status").textContent = message;
  const item = document.createElement("li");
  item.textContent = message;
  $("#activity-log").prepend(item);
  while ($("#activity-log").children.length > 8) $("#activity-log").lastElementChild.remove();
}

let rpcId = 0;
async function rpc(method, params) {
  const id = ++rpcId;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    credentials: "same-origin",
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`MCP endpoint returned HTTP ${response.status}. Use the Cloudflare preview (npm run dev) or the deployed site.`);
  const raw = await response.text();
  // Legacy Streamable HTTP uses SSE even for a single response. Modern MCP
  // can return JSON; support both, as the Cloudflare bridge does.
  const envelope = response.headers.get("content-type")?.includes("text/event-stream")
    ? raw.split(/\r?\n\r?\n/u).map(event => {
      const data = event.split(/\r?\n/u).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
      return data ? JSON.parse(data) : null;
    }).find(message => message?.id === id)
    : JSON.parse(raw);
  if (!envelope) throw new Error("MCP endpoint returned no matching response.");
  if (envelope.error) throw new Error(envelope.error.message || "MCP request failed.");
  if (envelope.result?.isError) throw new Error(envelope.result.content?.filter(block => block.type === "text").map(block => block.text).join("\n") || "Tool failed.");
  return envelope.result;
}

let responseSequence = 0;
function wireMcpForm(selector, label, method, params, format) {
  $(selector).addEventListener("submit", async event => {
    event.preventDefault();
    const sequence = ++responseSequence;
    const button = event.currentTarget.querySelector("button");
    const data = new FormData(event.currentTarget);
    button.disabled = true;
    $("#mcp-status").textContent = `Loading ${label}…`;
    $("#mcp-status").dataset.state = "loading";
    $("#mcp-output").hidden = true;
    try {
      const result = await rpc(method, params(data));
      record(`MCP: ${label} returned successfully.`);
      if (sequence !== responseSequence) return;
      $("#mcp-output").textContent = format(result);
      $("#mcp-output").hidden = false;
      $("#mcp-status").textContent = `${label} received`;
      $("#mcp-status").dataset.state = "success";
      $("#mcp-response-note").textContent = label === "Prompt" ? "These are instructions and source material for your model. No lesson has been generated." : "Live response from the MCP server.";
    } catch (error) {
      if (sequence !== responseSequence) return;
      $("#mcp-status").textContent = "Request failed";
      $("#mcp-status").dataset.state = "error";
      $("#mcp-response-note").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
wireMcpForm("#mcp-search-form", "Search results", "tools/call", data => ({
  name: "search_articles", arguments: { query: data.get("query"), limit: 5 },
}), result => JSON.stringify(result.structuredContent ?? result, null, 2));
wireMcpForm("#mcp-resource-form", "Article", "resources/read", data => ({ uri: data.get("uri") }), result => result.contents.map(content => content.text).join("\n\n"));
wireMcpForm("#mcp-prompt-form", "Prompt", "prompts/get", data => ({
  name: "plan_ai_learning_session", arguments: { audience: data.get("audience"), topic: data.get("topic") },
}), result => result.messages.map(({ content }) => content.type === "text" ? content.text : content.type === "resource" ? `SOURCE: ${content.resource.uri}\n\n${content.resource.text}` : "").join("\n\n---\n\n"));

// Fetch only the public catalog emitted by the same build as this page.
const catalog = fetch("/static/data/articles.json").then(response => {
  if (!response.ok) throw new Error("Article data could not be loaded. Refresh the page to try again.");
  return response.json();
});
// Handle early fetch failures even if no visitor has clicked a control yet.
catalog.catch(error => { $("#search-status").textContent = error.message; });

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

let selectedId;
function renderResults(articles) {
  const fragment = document.createDocumentFragment();
  if (!articles.length) fragment.append(element("p", "No articles matched. Try videos, reconciliation, or local AI.", "demo-article"));
  for (const article of articles) {
    const card = element("article", "", "demo-article");
    card.dataset.articleId = article.id;
    card.classList.toggle("is-selected", article.id === selectedId);
    card.append(element("p", article.date, "demo-article-date"));
    const heading = element("h4");
    const link = element("a", article.title);
    link.href = article.url;
    heading.append(link);
    const preview = element("button", "Preview article →", "text-link");
    preview.type = "button";
    preview.dataset.previewId = article.id;
    card.append(heading, element("p", article.excerpt), preview);
    fragment.append(card);
  }
  $("#article-results").replaceChildren(fragment);
}

async function findArticles(query, source) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 200) throw new Error("Enter between 1 and 200 characters to search.");
  const result = searchArticles(await catalog, trimmed, 20);
  renderResults(result.articles);
  $("#search-status").textContent = `${result.total} ${result.total === 1 ? "article" : "articles"} found for “${result.query}”.`;
  record(`${source}: searched for “${result.query}”; ${result.total} ${result.total === 1 ? "match" : "matches"}.`);
  return result;
}

$("#article-search").addEventListener("submit", event => {
  event.preventDefault();
  const query = new FormData(event.currentTarget).get("query");
  const result = findArticles(query, event.agentInvoked ? "Declarative WebMCP" : "Search form");
  // The native submit event must receive its promise synchronously.
  if (event.agentInvoked && typeof event.respondWith === "function") event.respondWith(result);
  result.catch(error => { $("#search-status").textContent = error.message; });
});
window.addEventListener("toolactivated", event => {
  if (event.toolName === "demo_find_articles") $("#search-status").textContent = "An agent filled the search form. Click Search articles to submit.";
});
window.addEventListener("toolcancel", event => {
  if (event.toolName === "demo_find_articles") $("#search-status").textContent = "Agent search cancelled. You can still search by hand.";
});

async function previewArticle(articleId, source = "Preview control") {
  const article = (await catalog).find(item => item.id === articleId);
  if (!article) throw new Error("Unknown article ID. Choose an ID returned by demo_find_articles.");
  selectedId = article.id;
  $("#preview-article").value = article.id;
  const preview = $("#article-preview");
  const link = element("a", "Read the full article →", "text-link");
  link.href = article.url;
  preview.replaceChildren(
    element("p", "Article preview", "eyebrow"),
    element("p", `${article.date} · ${article.tags.join(" / ")}`, "demo-small"),
    element("h3", article.title),
    element("p", article.excerpt),
    element("code", article.id),
    link,
  );
  for (const card of document.querySelectorAll("[data-article-id]")) card.classList.toggle("is-selected", card.dataset.articleId === article.id);
  preview.focus({ preventScroll: true });
  preview.scrollIntoView({ behavior: "instant", block: "nearest" });
  record(`${source}: previewed “${article.title}”.`);
  return { previewed: true, article: summarizeArticle(article) };
}
function reportPreviewError(error) { record(`Preview failed: ${error.message}`); }
$("#preview-form").addEventListener("submit", event => {
  event.preventDefault();
  previewArticle(new FormData(event.currentTarget).get("articleId")).catch(reportPreviewError);
});
$("#article-results").addEventListener("click", event => {
  const button = event.target.closest("[data-preview-id]");
  if (button) previewArticle(button.dataset.previewId).catch(reportPreviewError);
});

async function registerBrowserTool() {
  const context = document.modelContext ?? navigator.modelContext;
  if (!context?.registerTool) {
    $("#webmcp-status").textContent = "WebMCP isn't enabled in this browser. Try the controls by hand, or follow Chrome's setup instructions below to use an agent.";
    return;
  }
  const articles = await catalog;
  await context.registerTool({
    name: "demo_preview_article",
    description: "Preview a published Augmentic Accounting article on this page. Updates the visible preview and highlights a matching search result. Use an article ID from demo_find_articles or the allowed values. Returns the article details and canonical URL.",
    inputSchema: {
      type: "object",
      properties: { articleId: { type: "string", description: "The published article's year/month/slug ID.", enum: articles.map(article => article.id) } },
      required: ["articleId"],
      additionalProperties: false,
    },
    execute: ({ articleId }) => previewArticle(articleId, "Imperative WebMCP"),
  });
  $("#webmcp-status").textContent = "WebMCP is available. The search form and article preview are ready for an agent. You can also use the controls by hand.";
}
registerBrowserTool().catch(error => {
  $("#webmcp-status").textContent = `Browser tool registration failed: ${error.message} The manual controls are still available.`;
});
