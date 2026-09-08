import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  timeout: 30000,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:8792", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && wrangler dev --local --ip 127.0.0.1 --port 8792",
    url: "http://127.0.0.1:8792/agent-demo",
    timeout: 60000,
  },
});
