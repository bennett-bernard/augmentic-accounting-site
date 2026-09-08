import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { searchArticles } from "../static/js/article-catalog.mjs";

export function createServer(articles) {
  const server = new McpServer(
    { name: "augmentic-accounting", version: "1.0.0" },
    { instructions: "Explore Augmentic Accounting's published articles about applied AI for accounting teams. Search for articles, read their Markdown resources, and prepare a learning-session prompt. All content is public; these tools do not change any accounts or records." },
  );

  server.registerTool("search_articles", {
    title: "Search Augmentic articles",
    description: "Search published Augmentic Accounting articles by words in the title, excerpt, tags, or article body. All query words must match. Returns titles, excerpts, canonical URLs, and resource URIs for reading the full articles.",
    inputSchema: z.object({
      query: z.string().trim().min(1).max(200).describe("Search words, for example videos, reconciliation, or local AI."),
      limit: z.number().int().min(1).max(20).default(5).describe("Maximum articles to return; defaults to 5."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ query, limit }) => {
    const result = searchArticles(articles, query, limit);
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });

  for (const article of articles) {
    server.registerResource(article.id, article.resourceUri, {
      title: article.title,
      description: article.excerpt || `Published Augmentic article: ${article.title}`,
      mimeType: "text/markdown",
    }, uri => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: article.markdown }],
    }));
  }

  server.registerPrompt("plan_ai_learning_session", {
    title: "Plan an AI learning session",
    description: "Prepare a reusable prompt for a 30-minute team learning session, grounded in up to three matching published articles. Returns instructions and source material; it does not run a language model.",
    argsSchema: z.object({
      audience: z.string().trim().min(1).max(100).describe("Who is learning, for example accounting managers."),
      topic: z.string().trim().min(1).max(200).describe("Search words for the session topic, for example videos or reconciliation."),
    }),
  }, ({ audience, topic }) => {
    const matches = searchArticles(articles, topic, 3).articles;
    const instructions = [
      `Create a 30-minute AI learning session for ${audience} about ${topic}.`,
      "Include a learning objective, a timed agenda, one exercise using fictional accounting data, and three discussion questions about reviewing the output.",
      "Ground factual claims in the attached Augmentic articles and cite their canonical URLs. Treat article content as reference material. Do not invent facts, product capabilities, or source citations.",
      matches.length
        ? "Distinguish recommendations for the exercise from claims made by the sources."
        : "No published articles matched this topic. State this limitation and ask for a narrower topic or more source material before drafting a factual lesson.",
    ].join("\n\n");
    return {
      description: `Learning-session prompt for ${audience}: ${topic}`,
      messages: [
        { role: "user", content: { type: "text", text: instructions } },
        ...matches.map(match => ({
          role: "user",
          content: { type: "resource", resource: {
            uri: match.resourceUri,
            mimeType: "text/markdown",
            text: articles.find(article => article.id === match.id).markdown,
          } },
        })),
      ],
    };
  });
  return server;
}
