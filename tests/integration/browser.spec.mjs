import { test, expect } from "@playwright/test";

const articleId = "2026/09/ai-videos-for-accountants";
const title = "Turn tax returns and P&Ls into videos with AI.";

test.use({ launchOptions: { args: ["--disable-blink-features=WebMCP,WebMCPTesting"] } });

test("all three MCP controls return real server content", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/agent-demo");
  await page.locator("#mcp-search-form button").click();
  await expect(page.locator("#mcp-status")).toHaveText("Search results received");
  const result = JSON.parse(await page.locator("#mcp-output").textContent());
  expect(result.articles[0].id).toBe(articleId);
  await page.locator("#mcp-resource-form button").click();
  await expect(page.locator("#mcp-status")).toHaveText("Article received");
  await expect(page.locator("#mcp-output")).toContainText("# " + title);
  await page.locator("#mcp-prompt-form button").click();
  await expect(page.locator("#mcp-status")).toHaveText("Prompt received");
  await expect(page.locator("#mcp-output")).toContainText("30-minute AI learning session for accounting managers");
  await expect(page.locator("#mcp-output")).toContainText("SOURCE: augmentic://articles/" + articleId);
  await expect(page.locator("#mcp-response-note")).toContainText("No lesson has been generated");
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`search and preview remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/agent-demo");
    await expect(page.locator("#webmcp-status")).toContainText("isn't enabled");
    await page.locator("#article-search button").click();
    await expect(page.locator("#search-status")).toContainText("found for “videos”");
    await page.locator(`[data-preview-id="${articleId}"]`).click();
    await expect(page.locator("#article-preview h3")).toHaveText(title);
    await expect(page.locator(`[data-article-id="${articleId}"]`)).toHaveClass(/is-selected/);
    await expect(page.locator("#article-preview")).toBeFocused();
    await page.locator("#browser-query").fill("zzzzunmatchedtopic");
    await page.locator("#article-search button").click();
    await expect(page.locator("#article-results")).toContainText("No articles matched");
    await page.locator("#preview-form button").click();
    await expect(page.locator("#article-preview h3")).toHaveText(title);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("failed MCP requests explain the error and allow another attempt", async ({ page }) => {
  await page.goto("/agent-demo");
  await page.route("**/mcp", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.locator("#mcp-search-form button").click();
  await expect(page.locator("#mcp-status")).toHaveText("Request failed");
  await expect(page.locator("#mcp-response-note")).toContainText("HTTP 503");
  await expect(page.locator("#mcp-search-form button")).toBeEnabled();
  await page.unroute("**/mcp");
  await page.locator("#mcp-search-form button").click();
  await expect(page.locator("#mcp-status")).toHaveText("Search results received");
});
