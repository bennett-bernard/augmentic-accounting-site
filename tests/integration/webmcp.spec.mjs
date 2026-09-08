import { test, expect } from "@playwright/test";

const articleId = "2026/09/ai-videos-for-accountants";
const title = "Turn tax returns and P&Ls into videos with AI.";

test.use({ launchOptions: { args: ["--enable-experimental-web-platform-features", "--enable-blink-features=WebMCP,WebMCPTesting"] } });

test("declarative tool waits for submission and imperative tool updates the page", async ({ page }) => {
  await page.goto("/agent-demo");
  await expect(page.locator("#webmcp-status")).toContainText("WebMCP is available");
  const names = await page.evaluate(async () => (await document.modelContext.getTools()).map(tool => tool.name));
  expect(names).toEqual(["demo_find_articles", "demo_preview_article"]);
  await page.evaluate(async () => {
    const tools = await document.modelContext.getTools();
    window.demoPending = document.modelContext.executeTool(tools.find(tool => tool.name === "demo_find_articles"), JSON.stringify({ query: "videos" }));
    window.demoPending.then(result => { window.demoToolResult = result; window.demoToolSettled = true; });
  });
  await expect(page.locator("#browser-query")).toHaveValue("videos");
  await expect(page.locator("#search-status")).toContainText("An agent filled the search form");
  expect(await page.evaluate(() => Boolean(window.demoToolSettled))).toBe(false);
  await expect(page.locator("#activity-log li")).toHaveCount(0);
  await page.locator("#article-search button").click();
  await page.waitForFunction(() => window.demoToolSettled);
  const result = JSON.parse(await page.evaluate(() => window.demoToolResult));
  expect(result.articles[0].id).toBe(articleId);
  await expect(page.locator("#activity-status")).toContainText("Declarative WebMCP");
  const preview = await page.evaluate(async id => {
    const tools = await document.modelContext.getTools();
    return document.modelContext.executeTool(tools.find(tool => tool.name === "demo_preview_article"), JSON.stringify({ articleId: id }));
  }, result.articles[0].id);
  expect(JSON.parse(preview)).toMatchObject({ previewed: true, article: { id: articleId } });
  await expect(page.locator("#article-preview h3")).toHaveText(title);
  await expect(page.locator("#article-preview")).toBeFocused();
  await expect(page.locator("#activity-status")).toContainText("Imperative WebMCP");
  const invalid = await page.evaluate(async () => {
    try {
      const tools = await document.modelContext.getTools();
      await document.modelContext.executeTool(tools.find(tool => tool.name === "demo_preview_article"), JSON.stringify({ articleId: "nonexistent" }));
      return false;
    } catch { return true; }
  });
  expect(invalid).toBe(true);
  await expect(page.locator("#article-preview h3")).toHaveText(title);
});
