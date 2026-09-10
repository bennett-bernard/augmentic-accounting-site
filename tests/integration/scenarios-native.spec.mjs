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

test.use({ launchOptions: { args: ['--enable-experimental-web-platform-features', '--enable-blink-features=WebMCP,WebMCPTesting'] } });
test.describe('real native WebMCP', () => {
  for (const firm of firms) {
    test(`${firm}: native contact, appointment, and tax completion`, async ({ page }) => {
      await page.goto(`/webmcp/${firm}/contact-me`);
      await expect(page.locator('#webmcp-status')).toContainText('Native WebMCP ready');
      const state = await call(page, 'get_scenario_state');
      expect(Object.keys(state.fields.properties).sort()).toEqual(['email', 'message', 'name', 'phone']);
      expect(state.fields.required.sort()).toEqual(['email', 'message', 'name']);
      const inquiry = await call(page, 'submit_contact_inquiry', contact);
      expect(inquiry).toMatchObject({ simulated: true, status: 'completed' });
      await assertDone(page);
      expect((await call(page, 'submit_contact_inquiry', contact)).id).toBe(inquiry.id);
      await page.goto(`/webmcp/${firm}/book-meeting?date=2026-09-14`);
      await expect(page.locator('#webmcp-status')).toContainText('Native WebMCP ready');
      const availability = await call(page, 'get_available_appointments', { appointmentType: 'intro', timeZone: 'America/Chicago', startDate: '2026-09-14', endDate: '2026-09-14' });
      expect(availability.slots.length).toBeGreaterThan(0);
      const slotId = availability.slots[0].slotId;
      const apt = await call(page, 'book_appointment', { slotId, appointmentType: 'intro', timeZone: 'America/Chicago', attendee: { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', meetingMethod: 'video', consent: true } });
      expect(apt.slotId).toBe(slotId); await assertDone(page);
      await page.goto(`/webmcp/${firm}/tax-intake`);
      await expect(page.locator('#webmcp-status')).toContainText('Native WebMCP ready');
      await call(page, 'update_tax_step', { step: 'personal', fields: personal, advance: true });
      await call(page, 'add_tax_dependent', { name: 'Sam Morgan', dob: '2015-01-01', relationship: 'Child', months: '12' });
      await call(page, 'update_tax_step', { step: 'household', fields: { filingStatus: 'joint', spouseFirstName: 'Taylor', spouseLastName: 'Morgan', spouseDob: '1989-05-10', spouseTaxIdLast4: '5678' }, advance: true });
      await call(page, 'update_tax_step', { step: 'income', fields: { sources: ['selfEmployment'], businessName: 'Example Studio', businessType: 'Design', grossIncome: '20000', businessExpenses: '3000' }, advance: true });
      await call(page, 'update_tax_step', { step: 'deductions', fields: { deductions: ['charity'], charityAmount: '500' }, advance: true });
      await call(page, 'update_tax_step', { step: 'documents', fields: { documentPlan: 'later' }, advance: true });
      const result = await call(page, 'submit_tax_intake', { signature: 'Alex Morgan', consent: true });
      expect(result).toMatchObject({ simulated: true, status: 'completed', taxYear: '2025', documentPlan: 'later' });
      await assertDone(page);
    });
  }
  test('browser-only mode registers zero sample tools across navigation', async ({ page }) => {
    await page.goto('/webmcp/johnsoncpa/contact-me?webmcp=off&date=2026-09-14');
    await expect(page.locator('#webmcp-status')).toHaveText('Browser-only mode');
    expect(await page.evaluate(async () => (await document.modelContext.getTools()).length)).toBe(0);
    await page.getByRole('link', { name: 'Book a meeting', exact: true }).click();
    await expect(page).toHaveURL(/webmcp=off&date=2026-09-14/);
    expect(await page.evaluate(async () => (await document.modelContext.getTools()).length)).toBe(0);
  });
  test('native validation rejects invalid input and prevents skipping tax requirements', async ({ page }) => {
    await page.goto('/webmcp/johnsoncpa/contact-me');
    await expect(page.locator('#webmcp-status')).toContainText('ready');
    await expect(call(page, 'submit_contact_inquiry', { ...contact, email: 'bad' })).rejects.toThrow();
    await expect(call(page, 'submit_contact_inquiry', { ...contact, message: 'short' })).rejects.toThrow();
    await expect(call(page, 'submit_contact_inquiry', { ...contact, name: '   ' })).rejects.toThrow();
    await expect(page.locator('[data-completed]')).toHaveCount(0);
    await page.goto('/webmcp/johnsoncpa/tax-intake');
    await expect(page.locator('#webmcp-status')).toContainText('ready');
    await expect(call(page, 'go_to_tax_step', { step: 'review' })).rejects.toThrow();
    await call(page, 'update_tax_step', { step: 'personal', fields: personal, advance: true });
    await call(page, 'update_tax_step', { step: 'household', fields: { filingStatus: 'single' }, advance: true });
    await expect(call(page, 'update_tax_step', { step: 'income', fields: { sources: ['none', 'w2'] }, advance: true })).rejects.toThrow();
    await call(page, 'update_tax_step', { step: 'income', fields: { sources: ['none'] }, advance: true });
    await call(page, 'update_tax_step', { step: 'deductions', fields: { deductions: ['none'] }, advance: true });
    await expect(call(page, 'update_tax_step', { step: 'documents', fields: { documentPlan: 'attached' }, advance: true })).rejects.toThrow();
    await call(page, 'update_tax_step', { step: 'documents', fields: { documentPlan: 'later' }, advance: true });
    await call(page, 'go_to_tax_step', { step: 'personal' });
    await call(page, 'update_tax_step', { step: 'personal', fields: { email: 'invalid' } });
    await expect(call(page, 'go_to_tax_step', { step: 'review' })).rejects.toThrow();
    expect((await call(page, 'get_scenario_state')).currentStep).toBe('personal');
  });
  test('availability is deterministic, timezone-correct and rejects invalid slots', async ({ page }) => {
    await page.goto('/webmcp/sterlingadvisory/book-meeting?date=2026-10-30');
    await expect(page.locator('#webmcp-status')).toContainText('ready');
    const args = { timeZone: 'America/Denver', startDate: '2026-10-30', endDate: '2026-11-02' };
    const a = await call(page, 'get_available_appointments', args);
    const b = await call(page, 'get_available_appointments', args);
    expect(a).toEqual(b);
    expect(a.slots.some(slot => slot.time.endsWith('MDT'))).toBe(true);
    expect(a.slots.some(slot => slot.time.endsWith('MST'))).toBe(true);
    expect(a.slots.every(slot => !['2026-10-31', '2026-11-01'].includes(slot.date))).toBe(true);
    await expect(call(page, 'book_appointment', { appointmentType: 'intro', timeZone: 'UTC', slotId: '2026-10-31T02:00:00.000Z', attendee: { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', meetingMethod: 'video', consent: true } })).rejects.toThrow();
  });
});
