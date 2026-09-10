import { test, expect } from '@playwright/test';

const firms = ['johnsoncpa', 'bumblebookkeeping', 'harbortax', 'oakledger', 'sterlingadvisory'];
const contact = { name: 'Alex Morgan', email: 'alex@example.test', message: 'I need help organizing my small business books.' };
const personal = { taxYear: '2025', firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', dob: '1988-04-12', taxIdLast4: '1234', address: '123 Example Street', city: 'Austin', state: 'TX', zip: '78701' };
const household = { filingStatus: 'joint', spouseFirstName: 'Taylor', spouseLastName: 'Morgan', spouseDob: '1989-05-10', spouseTaxIdLast4: '5678', dependent0Name: 'Sam Morgan', dependent0Dob: '2015-01-01', dependent0Relationship: 'Child', dependent0Months: 12 };
const income = { sources: ['w2', 'selfEmployment'], businessName: 'Example Studio', businessType: 'Design', grossIncome: 20000, businessExpenses: 3000 };

test.use({ launchOptions: { args: ['--enable-experimental-web-platform-features', '--enable-blink-features=WebMCP,WebMCPTesting'] } });

async function names(page) {
  return page.evaluate(async () => (await document.modelContext.getTools()).map(tool => tool.name));
}
async function call(page, name, args = {}) {
  await expect.poll(() => names(page)).toContain(name);
  return page.evaluate(async ({ name, args }) => {
    const tool = (await document.modelContext.getTools()).find(tool => tool.name === name);
    return JSON.parse(await document.modelContext.executeTool(tool, JSON.stringify(args)));
  }, { name, args });
}
async function schema(page, name) {
  await expect.poll(() => names(page)).toContain(name);
  return page.evaluate(async name => {
    const tool = (await document.modelContext.getTools()).find(tool => tool.name === name);
    return JSON.parse(tool.inputSchema);
  }, name);
}
async function open(page, path) {
  await page.goto('/webmcp/' + path);
  await expect(page.locator('#webmcp-status')).toContainText('Native WebMCP ready');
}
async function openBookingDetails(page) {
  await page.locator('[data-date]:not(:disabled)').first().click();
  await page.locator('[data-slot]').first().click();
  await page.locator('#continue-booking').click();
  await expect(page.locator('#booking-form')).toBeVisible();
}

for (const firm of firms) {
  test(`${firm}: declarative forms complete contact, booking and every organizer step`, async ({ page }) => {
    const requests = [];
    const errors = [];
    page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await open(page, `${firm}/contact-me`);
    await expect(page.locator('#contact-form')).toHaveAttribute('toolname', 'submit_contact_inquiry');
    const contactSchema = await schema(page, 'submit_contact_inquiry');
    expect(Object.keys(contactSchema.properties).sort()).toEqual(['email', 'message', 'name', 'phone']);
    expect(contactSchema.required.sort()).toEqual(['email', 'message', 'name']);
    const inquiry = await call(page, 'submit_contact_inquiry', contact);
    expect(inquiry).toMatchObject({ simulated: true, status: 'completed', firm });
    await expect(page.locator('[data-completed]')).toBeVisible();
    await expect.poll(() => names(page)).not.toContain('submit_contact_inquiry');
    expect((await call(page, 'get_scenario_state')).receipt.id).toBe(inquiry.id);
    expect(await page.evaluate(() => window.__accountingBenchmark.events.some(event => event.action === 'completed' && event.source === 'declarative-webmcp'))).toBe(true);

    await open(page, `${firm}/book-meeting?date=2026-09-14`);
    expect(await names(page)).not.toContain('confirm_appointment');
    await openBookingDetails(page);
    await expect(page.locator('#booking-form')).toHaveAttribute('toolname', 'confirm_appointment');
    const selected = (await call(page, 'get_scenario_state')).selectedSlot;
    const appointment = await call(page, 'confirm_appointment', { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', meetingMethod: 'phone', phone: '555-0100', consent: true });
    expect(appointment).toMatchObject({ simulated: true, status: 'completed', slotId: selected, meetingMethod: 'phone' });
    await expect.poll(() => names(page)).not.toContain('confirm_appointment');

    await open(page, `${firm}/tax-intake`);
    expect(await names(page)).not.toContain('submit_tax_intake');
    expect((await call(page, 'complete_tax_personal', personal)).currentStep).toBe('household');
    await expect.poll(() => names(page)).not.toContain('complete_tax_personal');
    expect((await schema(page, 'complete_tax_household')).properties).not.toHaveProperty('spouseFirstName');
    // Prepare dynamic fields with existing helpers, then submit native HTML forms.
    await call(page, 'update_tax_step', { step: 'household', fields: { filingStatus: 'joint' } });
    await call(page, 'add_tax_dependent');
    const householdSchema = await schema(page, 'complete_tax_household');
    expect(householdSchema.required).toContain('spouseFirstName');
    expect(householdSchema.properties.dependent0Months.type).toBe('number');
    expect((await call(page, 'complete_tax_household', household)).currentStep).toBe('income');
    expect((await schema(page, 'complete_tax_income')).properties).not.toHaveProperty('businessName');
    await call(page, 'update_tax_step', { step: 'income', fields: { sources: ['selfEmployment'] } });
    expect((await schema(page, 'complete_tax_income')).properties.sources.type).toBe('array');
    expect((await call(page, 'complete_tax_income', income)).currentStep).toBe('deductions');
    expect((await schema(page, 'complete_tax_deductions')).properties).not.toHaveProperty('charityAmount');
    await call(page, 'update_tax_step', { step: 'deductions', fields: { deductions: ['charity'] } });
    expect((await call(page, 'complete_tax_deductions', { deductions: ['charity'], charityAmount: 500 })).currentStep).toBe('documents');
    expect(Object.keys((await schema(page, 'complete_tax_documents')).properties).sort()).toEqual(['documentNotes', 'documentPlan']);
    expect((await call(page, 'complete_tax_documents', { documentPlan: 'later' })).currentStep).toBe('review');
    const result = await call(page, 'submit_tax_intake', { signature: 'Alex Morgan', consent: true });
    expect(result).toMatchObject({ simulated: true, status: 'completed', taxYear: '2025', documentPlan: 'later' });
    await expect(page.locator('[data-completed]')).toBeVisible();
    await expect.poll(() => names(page)).not.toContain('submit_tax_intake');
    const record = await page.evaluate(() => window.__accountingBenchmark);
    expect(record.events.filter(event => event.source === 'declarative-webmcp' && event.action.startsWith('step_completed:'))).toHaveLength(5);
    expect(JSON.stringify(record)).not.toContain(personal.email);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('declarative validation returns errors and permits corrected input', async ({ page }) => {
  await open(page, 'johnsoncpa/contact-me');
  await expect(call(page, 'submit_contact_inquiry', { ...contact, message: 'short' })).rejects.toThrow();
  await expect(page.getByRole('alert')).toContainText('at least 10');
  await expect(call(page, 'submit_contact_inquiry', { ...contact, email: 'invalid' })).rejects.toThrow();
  await expect(page.locator('[data-completed]')).toHaveCount(0);
  expect((await call(page, 'submit_contact_inquiry', contact)).status).toBe('completed');

  await open(page, 'johnsoncpa/book-meeting?date=2026-09-14');
  await openBookingDetails(page);
  const attendee = { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', meetingMethod: 'phone', consent: true };
  await expect(call(page, 'confirm_appointment', attendee)).rejects.toThrow();
  await expect(page.getByRole('alert')).toContainText('phone number');
  await expect(call(page, 'confirm_appointment', { ...attendee, phone: '555-0100', consent: false })).rejects.toThrow();
  expect((await call(page, 'confirm_appointment', { ...attendee, phone: '555-0100' })).status).toBe('completed');
});

test('declarative branch changes reveal requirements without skipping validation', async ({ page }) => {
  await open(page, 'johnsoncpa/tax-intake');
  await call(page, 'complete_tax_personal', personal);
  await expect(call(page, 'complete_tax_household', { filingStatus: 'joint' })).rejects.toThrow();
  await expect(page.locator('#spouseFirstName')).toBeVisible();
  expect((await call(page, 'get_scenario_state')).currentStep).toBe('household');
  // Changing away from a conditional branch clears its requirements.
  expect((await call(page, 'complete_tax_household', { filingStatus: 'single', spouseFirstName: '', spouseLastName: '', spouseDob: '', spouseTaxIdLast4: '' })).currentStep).toBe('income');
  await expect(call(page, 'complete_tax_income', { sources: ['selfEmployment'] })).rejects.toThrow();
  await expect(page.locator('#businessName')).toBeVisible();
  await expect(call(page, 'complete_tax_income', { ...income, sources: ['none', 'selfEmployment'] })).rejects.toThrow();
  expect((await call(page, 'complete_tax_income', income)).currentStep).toBe('deductions');
  await expect(call(page, 'complete_tax_deductions', { deductions: ['charity'] })).rejects.toThrow();
  await expect(page.locator('#charityAmount')).toBeVisible();
  expect((await call(page, 'complete_tax_deductions', { deductions: ['charity'], charityAmount: 500 })).currentStep).toBe('documents');
  await expect(call(page, 'complete_tax_documents', { documentPlan: 'attached' })).rejects.toThrow();
  await expect(page.getByRole('alert')).toContainText('sample document');
  await call(page, 'complete_tax_documents', { documentPlan: 'later' });
  await expect(call(page, 'submit_tax_intake', { signature: 'Wrong Name', consent: true })).rejects.toThrow();
  await expect(call(page, 'submit_tax_intake', { signature: 'Alex Morgan', consent: false })).rejects.toThrow();
  expect((await call(page, 'submit_tax_intake', { signature: 'Alex Morgan', consent: true })).status).toBe('completed');
});

test('browser-only mode never exposes declarative annotations or native tools', async ({ page }) => {
  async function assertOff() {
    await expect(page.locator('[toolname], [tooldescription], [toolautosubmit]')).toHaveCount(0);
    expect(await names(page)).toEqual([]);
  }
  for (const firm of firms) {
    for (const scenario of ['contact-me', 'book-meeting', 'tax-intake']) {
      await page.goto(`/webmcp/${firm}/${scenario}?webmcp=off&date=2026-09-14`);
      await expect(page.locator('#webmcp-status')).toHaveText('Browser-only mode');
      await assertOff();
      if (scenario === 'book-meeting') { await openBookingDetails(page); await assertOff(); }
    }
  }
  for (const [name, value] of Object.entries(personal)) {
    const input = page.locator(`[name="${name}"]`);
    if (await input.evaluate(element => element.tagName === 'SELECT')) await input.selectOption(value);
    else await input.fill(value);
  }
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  await page.locator('#filingStatus').selectOption('joint');
  await page.getByRole('button', { name: '+ Add dependent' }).click();
  await assertOff();
});


test('declarative tool availability follows back navigation and resets', async ({ page }) => {
  await open(page, 'johnsoncpa/book-meeting?date=2026-09-14');
  await openBookingDetails(page);
  await expect.poll(() => names(page)).toContain('confirm_appointment');
  await page.locator('#change-time').click();
  await expect.poll(() => names(page)).not.toContain('confirm_appointment');
  await page.locator('[data-slot]').last().click();
  await page.locator('#continue-booking').click();
  await expect.poll(() => names(page)).toContain('confirm_appointment');

  await open(page, 'johnsoncpa/tax-intake');
  await call(page, 'complete_tax_personal', personal);
  await call(page, 'go_to_tax_step', { step: 'personal' });
  await expect.poll(() => names(page)).toContain('complete_tax_personal');
  await expect.poll(() => names(page)).not.toContain('complete_tax_household');
  await expect(page.locator('#firstName')).toHaveValue('Alex');
  await page.locator('.experiment-panel summary').click();
  await page.locator('#reset-run').click();
  await expect(page.locator('#firstName')).toHaveValue('');
  await expect.poll(() => names(page)).toContain('complete_tax_personal');
  expect((await call(page, 'get_scenario_state')).reachedSteps).toEqual(['personal']);
});
