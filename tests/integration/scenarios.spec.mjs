import { test, expect } from '@playwright/test';

const firms = ['johnsoncpa', 'bumblebookkeeping', 'harbortax', 'oakledger', 'sterlingadvisory'];
const contact = { name: 'Alex Morgan', email: 'alex@example.test', phone: '555-0100', message: 'I need help organizing my small business books.' };
const personal = { taxYear: '2025', firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', dob: '1988-04-12', taxIdLast4: '1234', address: '123 Example Street', city: 'Austin', state: 'TX', zip: '78701' };
async function fillFields(page, values) {
  for (const [name, value] of Object.entries(values)) {
    const input = page.locator(`[name="${name}"]`);
    if (typeof value === 'boolean') await input.setChecked(value);
    else if (await input.evaluate(element => element.tagName === 'SELECT')) await input.selectOption(value);
    else await input.fill(value);
  }
}
async function call(page, name, args = {}) {
  return page.evaluate(async ({ name, args }) => {
    const tools = await document.modelContext.getTools();
    const tool = tools.find(tool => tool.name === name);
    if (!tool) throw new Error(`Missing native tool ${name}`);
    return JSON.parse(await document.modelContext.executeTool(tool, JSON.stringify(args)));
  }, { name, args });
}
async function next(page) { await page.getByRole('button', { name: 'Continue →', exact: true }).click(); }
async function assertDone(page) {
  await expect(page.locator('[data-completed="true"]')).toBeVisible();
  expect(await page.evaluate(() => window.__accountingBenchmark.completed)).toBe(true);
}

for (const [index, firm] of firms.entries()) {
  test(`${firm}: contact browser workflow and reset`, async ({ page }) => {
    if (index % 2) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/webmcp/${firm}/contact-me?webmcp=off`);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('alert')).toContainText('Name');
    await expect(page.locator('#contact-form input, #contact-form textarea')).toHaveCount(4);
    await fillFields(page, contact);
    await page.getByRole('button', { name: 'Send message' }).click();
    await assertDone(page);
    expect(JSON.stringify(await page.evaluate(() => window.__accountingBenchmark))).not.toContain(contact.email);
    await page.getByRole('button', { name: 'Start a new test' }).click();
    await expect(page.locator('[name="name"]')).toHaveValue('');
    expect(await page.evaluate(() => window.__accountingBenchmark.completed)).toBe(false);
  });
  test(`${firm}: calendar browser workflow`, async ({ page }) => {
    if (index % 2) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/webmcp/${firm}/book-meeting?webmcp=off&date=2026-09-14`);
    await page.locator('#appointmentType').selectOption('tax');
    await page.locator('#timeZone').selectOption('America/Los_Angeles');
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.locator('[data-date]:not(:disabled)').first().click();
    await page.locator('[data-slot]').first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await fillFields(page, { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', meetingMethod: 'phone', phone: '555-0100', consent: true });
    await page.getByRole('button', { name: 'Confirm appointment' }).click();
    await assertDone(page);
    await expect(page.getByRole('status').first()).toContainText('America/Los_Angeles');
  });
  test(`${firm}: tax organizer browser workflow`, async ({ page }) => {
    if (index % 2) await page.setViewportSize({ width: 390, height: 844 });
    const posts = []; page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    await page.goto(`/webmcp/${firm}/tax-intake?webmcp=off`);
    await fillFields(page, personal); await next(page);
    await page.locator('#filingStatus').selectOption('joint');
    await fillFields(page, { spouseFirstName: 'Taylor', spouseLastName: 'Morgan', spouseDob: '1989-05-10', spouseTaxIdLast4: '5678' });
    await page.getByRole('button', { name: '+ Add dependent' }).click();
    await fillFields(page, { dependent0Name: 'Sam Morgan', dependent0Dob: '2015-01-01', dependent0Relationship: 'Child', dependent0Months: '12' });
    await next(page);
    await page.locator('input[value="w2"]').check();
    await page.locator('input[value="selfEmployment"]').check();
    await fillFields(page, { businessName: 'Example Studio', businessType: 'Design', grossIncome: '20000', businessExpenses: '3000' });
    await next(page);
    await page.locator('input[value="charity"]').check();
    await fillFields(page, { charityAmount: '500' }); await next(page);
    await page.locator('#tax-files').setInputFiles({ name: 'sample-w2.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic W-2 test document') });
    await page.locator('#documentPlan').selectOption('attached'); await next(page);
    await expect(page.locator('#workflow')).toContainText('Example Studio');
    await expect(page.locator('#workflow')).toContainText('Sam Morgan');
    await fillFields(page, { signature: 'Alex Morgan', consent: true });
    await page.getByRole('button', { name: 'Submit organizer' }).click();
    await assertDone(page); expect(posts).toEqual([]);
  });
}

test('all samples fit desktop and mobile screens without script errors', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    for (const firm of firms) for (const scenario of ['contact-me', 'book-meeting', 'tax-intake']) {
      await page.goto(`/webmcp/${firm}/${scenario}`);
      await expect(page.locator('#workflow')).not.toBeEmpty();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${firm}/${scenario} at ${width}px`).toBe(true);
      if (width === 1440 && scenario === 'contact-me') await page.screenshot({ path: `test-results/scenario-${firm}.png`, fullPage: true });
      if (width === 390 && firm === 'harbortax') await page.screenshot({ path: `test-results/scenario-mobile-${scenario}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test('legacy sample URLs redirect into /webmcp and preserve experiment settings', async ({ request, page, baseURL }) => {
  const redirects = [['/webmcp-lab', '/webmcp'], ['/tax-intake', '/webmcp/johnsoncpa/tax-intake']];
  for (const firm of firms) for (const suffix of ['', '/contact-me', '/book-meeting', '/tax-intake']) redirects.push([`/${firm}${suffix}`, `/webmcp/${firm}${suffix}`]);
  const query = '?webmcp=off&date=2026-09-14';
  for (const [old, target] of redirects) for (const slash of ['', '/']) {
    const response = await request.get(old + slash + query, { maxRedirects: 0 });
    expect(response.status(), old + slash).toBe(301);
    expect(new URL(response.headers().location, baseURL).href).toBe(baseURL + target + query);
  }
  await page.goto('/johnsoncpa/contact-me' + query);
  await expect(page).toHaveURL(baseURL + '/webmcp/johnsoncpa/contact-me' + query);
  await expect(page.locator('#webmcp-status')).toHaveText('Browser-only mode');
  await page.getByRole('link', { name: 'Book a meeting', exact: true }).click();
  await expect(page).toHaveURL(baseURL + '/webmcp/johnsoncpa/book-meeting' + query);
  await page.getByRole('link', { name: 'All samples' }).click();
  await expect(page).toHaveURL(baseURL + '/webmcp' + query);
  await expect(page.locator('.sample-primary')).toHaveCount(15);
  for (const href of await page.locator('.sample-links a').evaluateAll(links => links.map(link => link.getAttribute('href')))) expect(href).toMatch(/^\/webmcp\//);
});
