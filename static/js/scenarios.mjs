// Shared application actions power both the visible controls and native WebMCP.
// Demo state is page-local: no requests, uploads, email, calendar writes, or storage.
const { firm, scenario } = JSON.parse(document.querySelector('#scenario-config').textContent);
const root = document.querySelector('#workflow');
const params = new URLSearchParams(location.search);
const enabled = params.get('webmcp') !== 'off';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const uid = () => crypto.randomUUID().slice(0, 8).toUpperCase();
const run = { version: 1, firm: firm.slug, scenario, mode: enabled ? 'webmcp' : 'browser-only', nativeAvailable: false, registration: 'pending', startedAt: new Date().toISOString(), completed: false, events: [] };
const started = performance.now();
let receipt = null;
function record(action, source = 'ui') {
  run.events.push({ action, source, elapsedMs: Math.round(performance.now() - started) });
  document.querySelector('#run-status').textContent = run.completed ? 'Run complete' : `${run.events.length} recorded actions`;
}
function fail(message) { throw new Error(message); }
function showError(error) {
  let box = root.querySelector('.form-error');
  if (!box) { box = document.createElement('p'); box.className = 'form-error'; box.setAttribute('role', 'alert'); root.prepend(box); }
  box.textContent = error.message || String(error);
  box.tabIndex = -1;
  box.focus();
}
function safely(action) { try { return action(); } catch (error) { showError(error); } }
function complete(kind, title, message, detail, source) {
  if (receipt) return receipt;
  receipt = { id: `${kind}-${uid()}`, firm: firm.slug, scenario, simulated: true, status: 'completed', ...detail };
  run.completed = true;
  run.completedAt = new Date().toISOString();
  record('completed', source);
  run.durationMs = run.events.at(-1).elapsedMs;
  root.innerHTML = `<section class="success" tabindex="-1" data-completed="true"><span class="success-mark" aria-hidden="true">✓</span><p class="eyebrow">TEST SUBMISSION COMPLETE</p><h2>${esc(title)}</h2><p>${esc(message)}</p><div class="receipt" role="status">Reference <strong>${esc(receipt.id)}</strong>${detail.summary ? `<br>${esc(detail.summary)}` : ''}</div><p>This is a simulated confirmation. Nothing was sent, scheduled, or filed.</p><button type="button" class="secondary" data-restart>Start a new test</button></section>`;
  root.querySelector('[data-restart]').onclick = () => location.reload();
  root.querySelector('.success').focus();
  return receipt;
}
function field(name, label, options = {}) {
  const { type = 'text', required = true, full = false, value = '', choices, hint = '', ...attrs } = options;
  const attributes = `${required ? 'required' : ''} ${Object.entries(attrs).map(([key, value]) => `${key}="${esc(value)}"`).join(' ')} ${hint ? `aria-describedby="${name}-hint"` : ''}`;
  const control = choices
    ? `<select id="${name}" name="${name}" ${attributes}><option value="">Choose an option</option>${choices.map(item => { const [key, text] = Array.isArray(item) ? item : [item, item]; return `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`; }).join('')}</select>`
    : type === 'textarea'
      ? `<textarea id="${name}" name="${name}" ${attributes}>${esc(value)}</textarea>`
      : `<input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${attributes}>`;
  return `<div class="field${full ? ' full' : ''}"><label for="${name}">${esc(label)}${required ? ' *' : ''}</label>${control}${hint ? `<p id="${name}-hint" class="helper">${esc(hint)}</p>` : ''}</div>`;
}
function check(name, text, checked = false, required = false) {
  return `<label class="choice"><input type="checkbox" name="${name}" id="${name}" ${checked ? 'checked' : ''} ${required ? 'required' : ''}><span>${esc(text)}</span></label>`;
}
function choices(name, label, options, selected = []) {
  return `<fieldset class="full"><legend>${esc(label)}</legend><div class="choice-group">${options.map(([value, text]) => `<label class="choice choice-tile"><input type="checkbox" name="${name}" value="${value}" ${selected.includes(value) ? 'checked' : ''}><span>${esc(text)}</span></label>`).join('')}</div></fieldset>`;
}
function formData(form) {
  const result = {};
  for (const input of form.elements) {
    if (!input.name || input.disabled || input.type === 'file') continue;
    if (input.type === 'checkbox') {
      if (input.value !== 'on') { result[input.name] ??= []; if (input.checked) result[input.name].push(input.value); }
      else result[input.name] = input.checked;
    } else if (input.type === 'radio') { if (input.checked) result[input.name] = input.value; }
    else if (['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName)) result[input.name] = input.value.trim();
  }
  return result;
}
function validate(form) {
  // The same constraint validation runs for tool and UI submissions.
  for (const input of form.elements) {
    if (['text', 'email', 'tel', 'textarea'].includes(input.type)) {
      input.value = input.value.trim();
      input.setCustomValidity('');
      if (input.value && input.minLength > 0 && input.value.length < input.minLength) input.setCustomValidity(`Use at least ${input.minLength} characters.`);
      if (input.maxLength > 0 && input.value.length > input.maxLength) input.setCustomValidity(`Use no more than ${input.maxLength} characters.`);
    }
  }
  if (!form.checkValidity()) {
    const input = [...form.elements].find(item => item.willValidate && !item.validity.valid);
    const label = input.labels?.[0]?.textContent || input.name;
    input.focus();
    fail(`${label}: ${input.validationMessage}`);
  }
  return formData(form);
}
function fill(form, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail('Provide a fields object.');
  // Check every key and type before changing the form.
  for (const [name, value] of Object.entries(values)) {
    const inputs = [...form.elements].filter(input => input.name === name && !input.disabled);
    if (!inputs.length || inputs[0].type === 'file') fail(`Unknown or unavailable field: ${name}`);
    const input = inputs[0];
    if (input.type === 'checkbox' && input.value !== 'on') {
      if (!Array.isArray(value) || value.some(item => !inputs.some(control => control.value === item))) fail(`Use the listed choices for ${name}.`);
    } else if (input.type === 'checkbox') { if (typeof value !== 'boolean') fail(`${name} must be true or false.`); }
    else if (typeof value !== 'string' && typeof value !== 'number') fail(`${name} must be text or a number.`);
    else if (input.tagName === 'SELECT' && ![...input.options].some(option => option.value === String(value))) fail(`Use a listed option for ${name}.`);
  }
  for (const [name, value] of Object.entries(values)) {
    const inputs = [...form.elements].filter(input => input.name === name && !input.disabled);
    for (const input of inputs) {
      if (input.type === 'checkbox') input.checked = input.value === 'on' ? value : value.includes(input.value);
      else input.value = String(value);
    }
  }
}
function formSchema() {
  const form = root.querySelector('form');
  if (!form) return { type: 'object', properties: {} };
  const properties = {};
  const required = [];
  for (const input of form.elements) {
    if (!input.name || input.disabled || input.type === 'file') continue;
    const description = input.labels?.[0]?.textContent?.trim() || input.name;
    if (input.type === 'checkbox' && input.value !== 'on') {
      properties[input.name] ??= { type: 'array', description: input.closest('fieldset').querySelector('legend').textContent, items: { type: 'string', enum: [] }, uniqueItems: true };
      properties[input.name].items.enum.push(input.value);
    } else if (input.type === 'checkbox') properties[input.name] = { type: 'boolean', description };
    else {
      properties[input.name] = { type: 'string', description };
      if (input.tagName === 'SELECT') properties[input.name].enum = [...input.options].filter(option => option.value).map(option => option.value);
      if (input.type === 'date') properties[input.name].description += ' (YYYY-MM-DD)';
      if (input.pattern) properties[input.name].pattern = input.pattern;
    }
    if (input.required) required.push(input.name);
  }
  return { type: 'object', properties, required, additionalProperties: false };
}

// Contact workflow.
function renderContact() {
  root.innerHTML = `<form id="contact-form" novalidate><div class="fields">${field('name', 'Name', { autocomplete: 'name', maxlength: 160, full: true })}${field('email', 'Email address', { type: 'email', autocomplete: 'email', maxlength: 200 })}${field('phone', 'Phone number', { type: 'tel', required: false, autocomplete: 'tel', maxlength: 40 })}${field('message', 'Message', { type: 'textarea', full: true, minlength: 10, maxlength: 3000, placeholder: 'A little about your needs, questions, or goals…' })}</div><div class="form-actions"><button class="primary" type="submit">Send message <span aria-hidden="true">→</span></button></div><p class="form-note">Please use fictional details and leave out sensitive financial information.</p></form>`;
  root.querySelector('form').onsubmit = event => { event.preventDefault(); safely(() => submitContact(undefined, 'ui')); };
}
function submitContact(values, source = 'webmcp') {
  if (receipt) return receipt;
  const form = root.querySelector('form');
  if (values) fill(form, values);
  const data = validate(form);
  return complete('MSG', `Thank you, ${data.name}.`, `Your inquiry for ${firm.name} is complete.`, {}, source);
}

// Calendar workflow. Every slot is an unambiguous UTC instant, displayed in the selected zone.
const dateKey = date => date.toISOString().slice(0, 10);
const parsedAnchor = params.get('date');
const validAnchor = /^\d{4}-\d{2}-\d{2}$/.test(parsedAnchor || '') && !Number.isNaN(Date.parse(parsedAnchor)) && dateKey(new Date(parsedAnchor)) === parsedAnchor;
const anchor = new Date(validAnchor ? `${parsedAnchor}T00:00:00Z` : `${dateKey(new Date())}T00:00:00Z`);
if (!validAnchor) anchor.setUTCDate(anchor.getUTCDate() + 1);
run.calendarAnchor = dateKey(anchor);
const zones = [['America/New_York', 'Eastern time'], ['America/Chicago', 'Central time'], ['America/Denver', 'Mountain time'], ['America/Los_Angeles', 'Pacific time'], ['UTC', 'UTC']];
const meetingTypes = [['intro', 'Introductory call · 30 min'], ['tax', 'Tax consultation · 60 min'], ['books', 'Bookkeeping review · 45 min']];
const durations = { intro: 30, tax: 60, books: 45 };
const booking = { type: 'intro', zone: firm.timezone, month: new Date(anchor), day: '', slot: '', stage: 'calendar', details: {} };
booking.month.setUTCDate(1);
function partsInZone(date, zone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}
function dayInZone(date, zone) { const p = partsInZone(date, zone); return `${p.year}-${p.month}-${p.day}`; }
function localToUtc(day, hour, zone) {
  const target = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = partsInZone(new Date(guess), zone);
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    guess += target - represented;
  }
  return new Date(guess);
}
function getAvailability({ appointmentType = booking.type, timeZone = booking.zone, startDate, endDate } = {}) {
  if (!Object.hasOwn(durations, appointmentType)) fail('Unknown appointment type. Choose intro, tax, or books.');
  if (!zones.some(([zone]) => zone === timeZone)) fail('Unsupported time zone.');
  for (const value of [startDate, endDate].filter(value => value !== undefined)) if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || dateKey(new Date(value)) !== value) fail('Dates must be valid YYYY-MM-DD values.');
  if (startDate && endDate && startDate > endDate) fail('End date must be on or after start date.');
  const slots = [];
  const seed = firm.slug.length;
  for (let offset = 0; offset < 60; offset++) {
    const date = new Date(anchor); date.setUTCDate(date.getUTCDate() + offset);
    if ([0, 6].includes(date.getUTCDay())) continue;
    for (const hour of [9, 10, 11, 13, 14, 15]) {
      if ((date.getUTCDate() + hour + seed) % 4 === 0) continue;
      const instant = localToUtc(dateKey(date), hour, firm.timezone);
      const day = dayInZone(instant, timeZone);
      if ((startDate && day < startDate) || (endDate && day > endDate)) continue;
      slots.push({ slotId: instant.toISOString(), date: day, time: new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(instant), durationMinutes: durations[appointmentType] });
    }
  }
  return { appointmentType, timeZone, calendarAnchor: dateKey(anchor), slots };
}
function slotSummary(slot, type = booking.type, zone = booking.zone) {
  return `${meetingTypes.find(([key]) => key === type)[1]} · ${new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(slot))} (${zone})`;
}
function renderBooking() {
  if (booking.stage === 'details') return renderBookingDetails();
  const slots = getAvailability().slots;
  const month = booking.month;
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  let calendar = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => `<span class="weekday">${day}</span>`).join('');
  calendar += '<span></span>'.repeat(month.getUTCDay());
  for (let day = 1; day <= days; day++) {
    const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day));
    const key = dateKey(date);
    const available = slots.some(slot => slot.date === key);
    calendar += `<button class="calendar-day" type="button" data-date="${key}" aria-label="${date.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}" aria-pressed="${booking.day === key}" ${available ? '' : 'disabled'}>${day}</button>`;
  }
  const monthTitle = month.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const end = new Date(anchor); end.setUTCDate(end.getUTCDate() + 59); end.setUTCDate(1);
  const minMonth = new Date(anchor); minMonth.setUTCDate(1);
  root.innerHTML = `<h2>Choose your appointment</h2><div class="meeting-options">${field('appointmentType', 'Meeting type', { choices: meetingTypes, value: booking.type })}${field('timeZone', 'Your time zone', { choices: zones, value: booking.zone })}</div><div class="calendar-columns"><section aria-label="Appointment calendar"><div class="calendar-nav"><button class="icon-button" type="button" aria-label="Previous month" id="previous-month" ${month <= minMonth ? 'disabled' : ''}>‹</button><strong aria-live="polite">${monthTitle}</strong><button class="icon-button" type="button" aria-label="Next month" id="next-month" ${month >= end ? 'disabled' : ''}>›</button></div><div class="calendar-grid">${calendar}</div><p class="calendar-caption">Weekdays · Availability for the next 60 days</p></section><section aria-label="Available times"><h3 class="time-heading">${booking.day ? esc(new Date(`${booking.day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' })) : 'Select a date to see times'}</h3><div class="time-slots">${slots.filter(slot => slot.date === booking.day).map(slot => `<button type="button" class="time-slot" data-slot="${slot.slotId}" aria-pressed="${booking.slot === slot.slotId}">${slot.time}</button>`).join('')}</div></section></div>${booking.slot ? `<div class="booking-selection" role="status">${esc(slotSummary(booking.slot))}</div>` : ''}<div class="form-actions"><button id="continue-booking" type="button" class="primary" ${booking.slot ? '' : 'disabled'}>Continue <span aria-hidden="true">→</span></button></div>`;
  root.querySelector('#appointmentType').onchange = event => { booking.type = event.target.value; booking.slot = ''; record('meeting_type_changed'); renderBooking(); };
  root.querySelector('#timeZone').onchange = event => { booking.zone = event.target.value; booking.slot = ''; booking.day = ''; record('time_zone_changed'); renderBooking(); };
  root.querySelector('#previous-month').onclick = () => { booking.month.setUTCMonth(booking.month.getUTCMonth() - 1); record('month_changed'); renderBooking(); };
  root.querySelector('#next-month').onclick = () => { booking.month.setUTCMonth(booking.month.getUTCMonth() + 1); record('month_changed'); renderBooking(); };
  root.querySelectorAll('[data-date]').forEach(button => button.onclick = () => { booking.day = button.dataset.date; booking.slot = ''; record('date_selected'); renderBooking(); root.querySelector(`[data-date="${booking.day}"]`).focus(); });
  root.querySelectorAll('[data-slot]').forEach(button => button.onclick = () => { booking.slot = button.dataset.slot; record('time_selected'); renderBooking(); root.querySelector(`[data-slot="${booking.slot}"]`).focus(); });
  root.querySelector('#continue-booking').onclick = () => { booking.stage = 'details'; record('booking_details_opened'); renderBookingDetails(); root.querySelector('input').focus(); };
}
function renderBookingDetails() {
  root.innerHTML = `<button type="button" class="text-button" id="change-time">← Change date or time</button><h2 style="margin-top:20px">Your meeting details</h2><p class="booking-selection">${esc(slotSummary(booking.slot))}</p><form id="booking-form" novalidate><div class="fields">${field('firstName', 'First name', { value: booking.details.firstName, maxlength: 80 })}${field('lastName', 'Last name', { value: booking.details.lastName, maxlength: 80 })}${field('email', 'Email address', { type: 'email', full: true, value: booking.details.email, maxlength: 200 })}${field('meetingMethod', 'How would you like to meet?', { choices: [['video', 'Video call'], ['phone', 'Phone call']], value: booking.details.meetingMethod || 'video', full: true })}${field('phone', 'Phone number', { type: 'tel', value: booking.details.phone, required: false, full: true, maxlength: 40, hint: 'Required for a phone call.' })}${field('notes', 'Anything you would like us to know?', { type: 'textarea', value: booking.details.notes, required: false, full: true, maxlength: 2000 })}</div><div class="consent">${check('consent', 'I confirm these appointment details. *', booking.details.consent, true)}</div><div class="form-actions"><button type="submit" class="primary">Confirm appointment</button></div></form>`;
  root.querySelector('#change-time').onclick = () => { booking.details = formData(root.querySelector('form')); booking.stage = 'calendar'; renderBooking(); };
  root.querySelector('form').onsubmit = event => { event.preventDefault(); safely(() => submitBooking(undefined, 'ui')); };
}
function submitBooking(args, source = 'webmcp') {
  if (receipt) return receipt;
  if (args) {
    const { slotId, appointmentType, timeZone, attendee } = args;
    const available = getAvailability({ appointmentType, timeZone }).slots;
    if (!available.some(slot => slot.slotId === slotId)) fail('That slot is unavailable. Choose a slotId from get_available_appointments.');
    booking.type = appointmentType; booking.zone = timeZone; booking.slot = slotId;
    booking.day = dayInZone(new Date(slotId), timeZone); booking.stage = 'details';
    renderBookingDetails(); fill(root.querySelector('form'), attendee);
  }
  if (!getAvailability().slots.some(slot => slot.slotId === booking.slot)) fail('Choose an available appointment before confirming.');
  const data = validate(root.querySelector('form'));
  if (data.meetingMethod === 'phone' && !data.phone) fail('Enter a phone number for a phone meeting.');
  booking.details = data;
  return complete('APT', 'Your time is reserved.', `Your test appointment with ${firm.advisor} is complete.`, { slotId: booking.slot, appointmentType: booking.type, timeZone: booking.zone, meetingMethod: data.meetingMethod, summary: slotSummary(booking.slot) }, source);
}

// Single-page individual tax organizer.
const steps = ['Personal details', 'Household', 'Income', 'Deductions', 'Documents', 'Review & submit'];
const stepKeys = ['personal', 'household', 'income', 'deductions', 'documents', 'review'];
const intake = { step: 0, furthest: 0, data: { personal: {}, household: {}, income: { sources: [] }, deductions: { deductions: [] }, documents: {}, review: {} }, dependents: [], files: [] };
const filingStatuses = [['single', 'Single'], ['joint', 'Married filing jointly'], ['separate', 'Married filing separately'], ['head', 'Head of household'], ['surviving', 'Qualifying surviving spouse']];
const incomeOptions = [['w2', 'Wages & salary (W-2)'], ['selfEmployment', 'Self-employment / freelance'], ['investments', 'Interest, dividends & investments'], ['retirement', 'Retirement / Social Security'], ['rental', 'Rental property'], ['other', 'Other income'], ['none', 'No income to report']];
const deductionOptions = [['mortgage', 'Mortgage interest'], ['charity', 'Charitable donations'], ['education', 'Education expenses'], ['studentLoan', 'Student loan interest'], ['medical', 'Medical expenses'], ['hsa', 'Health savings account'], ['none', 'None of these']];
const today = dateKey(new Date());
const states = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
function householdFields(data) {
  let result = field('filingStatus', 'Expected filing status', { choices: filingStatuses, full: true, value: data.filingStatus });
  if (['joint', 'separate'].includes(data.filingStatus)) result += `<div class="full subsection"><h3>Spouse information</h3><div class="fields">${field('spouseFirstName', 'Spouse first name', { value: data.spouseFirstName, maxlength: 80 })}${field('spouseLastName', 'Spouse last name', { value: data.spouseLastName, maxlength: 80 })}${field('spouseDob', 'Spouse date of birth', { type: 'date', max: today, value: data.spouseDob })}${field('spouseTaxIdLast4', 'Spouse tax ID — last 4 digits', { value: data.spouseTaxIdLast4, pattern: '[0-9]{4}', maxlength: 4, inputmode: 'numeric' })}</div></div>`;
  result += `<div class="full"><h3>Dependents</h3><p class="helper">Add anyone you expect to claim. Leave empty if you have no dependents.</p>${intake.dependents.map((dependent, index) => `<div class="subsection"><div class="dependent-head"><strong>Dependent ${index + 1}</strong><button type="button" class="text-button" data-remove-dependent="${index}">Remove dependent ${index + 1}</button></div><div class="fields">${field(`dependent${index}Name`, 'Dependent full name', { value: dependent.name, maxlength: 120 })}${field(`dependent${index}Dob`, 'Dependent date of birth', { type: 'date', max: today, value: dependent.dob })}${field(`dependent${index}Relationship`, 'Relationship', { choices: ['Child', 'Parent', 'Other relative'], value: dependent.relationship })}${field(`dependent${index}Months`, 'Months living with you', { type: 'number', min: 0, max: 12, step: 1, value: dependent.months ?? '12' })}</div></div>`).join('')}<button type="button" id="add-dependent" class="secondary" style="margin-top:18px">+ Add dependent</button></div>`;
  return result;
}
function saveCurrent() {
  const form = root.querySelector('form');
  if (!form) return;
  const data = formData(form);
  intake.data[stepKeys[intake.step]] = data;
  if (intake.step === 1) intake.dependents = intake.dependents.map((_, index) => ({ name: data[`dependent${index}Name`] || '', dob: data[`dependent${index}Dob`] || '', relationship: data[`dependent${index}Relationship`] || '', months: data[`dependent${index}Months`] ?? '12' }));
}
function incomeFields(data) {
  return choices('sources', 'Which types of income did you receive? *', incomeOptions, data.sources || []) + (data.sources?.includes('selfEmployment') ? `<div class="full subsection"><h3>About your business</h3><div class="fields">${field('businessName', 'Business name', { value: data.businessName, maxlength: 120 })}${field('businessType', 'Type of work', { value: data.businessType, maxlength: 120 })}${field('grossIncome', 'Gross business income ($)', { type: 'number', min: 0, step: '.01', value: data.grossIncome })}${field('businessExpenses', 'Business expenses ($)', { type: 'number', min: 0, step: '.01', value: data.businessExpenses })}</div></div>` : '') + field('incomeNotes', 'Additional income details', { type: 'textarea', required: false, full: true, value: data.incomeNotes, maxlength: 2000 });
}
function deductionFields(data) {
  return choices('deductions', 'Which items apply to you? *', deductionOptions, data.deductions || []) + (data.deductions?.includes('charity') ? field('charityAmount', 'Total charitable donations ($)', { type: 'number', min: 0, step: '.01', value: data.charityAmount, full: true }) : '') + field('deductionNotes', 'Anything else we should know?', { type: 'textarea', required: false, full: true, value: data.deductionNotes, maxlength: 2000 });
}
function requestedDocuments() {
  const list = ['Prior-year tax return'];
  const names = { w2: 'W-2 wage statements', selfEmployment: '1099-NEC / business income and expense summary', investments: '1099-INT, 1099-DIV and brokerage statements', retirement: '1099-R / SSA-1099', rental: 'Rental income and expense summary', other: 'Other income records' };
  for (const source of intake.data.income.sources || []) if (names[source]) list.push(names[source]);
  if (intake.data.deductions.deductions?.includes('mortgage')) list.push('Form 1098 mortgage interest statement');
  if (intake.data.deductions.deductions?.includes('charity')) list.push('Charitable contribution receipts');
  return list;
}
function documentFields(data) {
  return `<div class="full"><h3>Your document checklist</h3><ul class="document-list">${requestedDocuments().map(name => `<li>${esc(name)}</li>`).join('')}</ul><div class="upload-zone"><label for="tax-files"><strong>Add sample documents</strong></label><p class="helper">PDF, JPG, PNG or TXT · Up to 5 files, 10 MB each. Only filenames are held in memory; file contents are never read or uploaded.</p><input id="tax-files" type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" multiple><ul class="document-list">${intake.files.map((file, index) => `<li><span>${esc(file.name)} (${Math.ceil(file.size / 1024)} KB)</span><button type="button" class="text-button" data-remove-file="${index}">Remove ${esc(file.name)}</button></li>`).join('')}</ul></div></div>${field('documentPlan', 'Document status', { full: true, choices: [['attached', 'I have attached my sample documents'], ['later', 'I will provide documents later']], value: data.documentPlan })}${field('documentNotes', 'Notes about missing documents', { type: 'textarea', full: true, required: false, value: data.documentNotes, maxlength: 1500 })}`;
}
function reviewFields() {
  const p = intake.data.personal, h = intake.data.household, i = intake.data.income, d = intake.data.deductions;
  const summary = [
    ['Personal details', [['Name', `${p.firstName} ${p.lastName}`], ['Email', p.email], ['Tax year', p.taxYear], ['Date of birth', p.dob], ['Tax ID (last four)', `••• •• ${p.taxIdLast4}`], ['Address', `${p.address}, ${p.city}, ${p.state} ${p.zip}`]]],
    ['Household', [['Filing status', filingStatuses.find(([value]) => value === h.filingStatus)?.[1]], ...(['joint', 'separate'].includes(h.filingStatus) ? [['Spouse', `${h.spouseFirstName} ${h.spouseLastName}`], ['Spouse birth date', h.spouseDob], ['Spouse tax ID', `••• •• ${h.spouseTaxIdLast4}`]] : []), ['Dependents', intake.dependents.length ? intake.dependents.map(person => `${person.name} (${person.relationship}, born ${person.dob}, ${person.months} months)`).join('; ') : 'None']]],
    ['Income', [['Income sources', (i.sources || []).map(value => incomeOptions.find(([key]) => key === value)?.[1]).join(', ')], ...(i.sources?.includes('selfEmployment') ? [['Business', i.businessName], ['Type of work', i.businessType], ['Gross income', i.grossIncome], ['Expenses', i.businessExpenses]] : []), ['Notes', i.incomeNotes || 'None']]],
    ['Deductions', [['Selected items', (d.deductions || []).map(value => deductionOptions.find(([key]) => key === value)?.[1]).join(', ')], ...(d.deductions?.includes('charity') ? [['Donations', d.charityAmount]] : []), ['Notes', d.deductionNotes || 'None']]],
    ['Documents', [['Plan', intake.data.documents.documentPlan === 'later' ? 'Provide later' : 'Sample documents attached'], ['Files', intake.files.map(file => file.name).join(', ') || 'None attached'], ['Notes', intake.data.documents.documentNotes || 'None']]],
  ];
  return `<div class="full">${summary.map(([title, rows], index) => `<section class="review-section"><h3>${title}<button type="button" class="text-button" data-edit-step="${index}">Edit ${title.toLowerCase()}</button></h3><dl>${rows.map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')}</dl></section>`).join('')}</div>${field('signature', 'Type your full name to sign', { value: intake.data.review.signature, full: true, maxlength: 160 })}<div class="full consent">${check('consent', 'I have reviewed this test organizer and confirm it is ready to submit. *', intake.data.review.consent, true)}</div>`;
}
function renderIntake(focus = false) {
  const step = intake.step;
  const data = intake.data[stepKeys[step]];
  document.querySelector('#intake-steps').innerHTML = steps.map((name, index) => `<button class="step-item" type="button" data-step="${index}" ${index === step ? 'aria-current="step"' : ''} ${index > intake.furthest || receipt ? 'disabled' : ''}><span class="step-number">${index < step ? '✓' : index + 1}</span><span>${name}</span></button>`).join('');
  document.querySelectorAll('[data-step]').forEach(button => button.onclick = () => safely(() => goToStep(Number(button.dataset.step), 'ui')));
  const descriptions = ['Use fictional personal information for this demonstration. Only the last four digits of a test tax ID are requested.', 'Tell us about your filing status and the people in your household.', 'Select all that apply. Your choices will shape the document checklist.', 'Select the expenses and contributions you would like your preparer to review.', 'Collect your supporting records. You can continue with a plan to provide them later.', 'Check your answers before submitting your test organizer.'];
  let fields = '';
  if (step === 0) fields = field('taxYear', 'Tax year', { choices: ['2025', '2026'], value: data.taxYear || '2025', full: true }) + field('firstName', 'First name', { value: data.firstName, maxlength: 80 }) + field('lastName', 'Last name', { value: data.lastName, maxlength: 80 }) + field('email', 'Email address', { type: 'email', value: data.email, maxlength: 200 }) + field('phone', 'Phone number', { type: 'tel', value: data.phone, required: false, maxlength: 40 }) + field('dob', 'Date of birth', { type: 'date', value: data.dob, max: today, min: '1900-01-01' }) + field('taxIdLast4', 'Test tax ID — last 4 digits', { value: data.taxIdLast4, pattern: '[0-9]{4}', maxlength: 4, inputmode: 'numeric', hint: 'Use a fictional value such as 1234.' }) + field('address', 'Street address', { value: data.address, full: true, maxlength: 200 }) + field('city', 'City', { value: data.city, maxlength: 100 }) + field('state', 'State', { choices: states, value: data.state }) + field('zip', 'ZIP code', { value: data.zip, pattern: '[0-9]{5}(-[0-9]{4})?', maxlength: 10, inputmode: 'numeric' });
  if (step === 1) fields = householdFields(data);
  if (step === 2) fields = incomeFields(data);
  if (step === 3) fields = deductionFields(data);
  if (step === 4) fields = documentFields(data);
  if (step === 5) fields = reviewFields();
  root.innerHTML = `<div class="step-top"><span>Step ${step + 1} of ${steps.length}</span><span>Progress stays in this page</span></div><div class="progress-track" role="progressbar" aria-label="Organizer progress" aria-valuenow="${step}" aria-valuemin="0" aria-valuemax="6"><span style="width:${step / 6 * 100}%"></span></div><h2 tabindex="-1">${steps[step]}</h2><p class="section-description">${descriptions[step]}</p><form id="intake-form" novalidate><div class="fields">${fields}</div><div class="form-actions">${step ? '<button type="button" class="secondary" id="back-step">← Back</button>' : '<span class="helper">* Required fields</span>'}<button type="submit" class="primary">${step === 5 ? 'Submit organizer' : 'Continue →'}</button></div></form>`;
  if (focus) root.querySelector('h2').focus();
  const form = root.querySelector('form');
  form.onsubmit = event => { event.preventDefault(); safely(() => nextIntake('ui')); };
  root.querySelector('#back-step')?.addEventListener('click', () => { saveCurrent(); intake.step--; record('step_back'); renderIntake(true); });
  root.querySelector('#filingStatus')?.addEventListener('change', () => { saveCurrent(); cleanConditional(); renderIntake(); root.querySelector('#filingStatus').focus(); });
  root.querySelectorAll('input[name="sources"],input[name="deductions"]').forEach(input => input.onchange = () => {
    if (input.checked) form.querySelectorAll(`input[name="${input.name}"]`).forEach(other => { if (other !== input && (input.value === 'none' || other.value === 'none')) other.checked = false; });
    saveCurrent(); cleanConditional(); const name = input.name, value = input.value; renderIntake(); root.querySelector(`input[name="${name}"][value="${value}"]`).focus();
  });
  root.querySelector('#add-dependent')?.addEventListener('click', () => safely(() => addDependent({}, 'ui')));
  root.querySelectorAll('[data-remove-dependent]').forEach(button => button.onclick = () => { saveCurrent(); intake.dependents.splice(Number(button.dataset.removeDependent), 1); record('dependent_removed'); renderIntake(); });
  root.querySelector('#tax-files')?.addEventListener('change', event => safely(() => {
    const files = [...event.target.files];
    if (intake.files.length + files.length > 5) fail('Choose no more than 5 sample documents in total.');
    if (files.some(file => !/\.(pdf|jpe?g|png|txt)$/i.test(file.name) || file.size > 10 * 1024 * 1024)) fail('Use PDF, JPG, PNG or TXT files, up to 10 MB each.');
    saveCurrent(); intake.files.push(...files.map(file => ({ name: file.name, size: file.size })));
    record('sample_files_selected'); renderIntake();
  }));
  root.querySelectorAll('[data-remove-file]').forEach(button => button.onclick = () => { saveCurrent(); intake.files.splice(Number(button.dataset.removeFile), 1); record('sample_file_removed'); renderIntake(); });
  root.querySelectorAll('[data-edit-step]').forEach(button => button.onclick = () => { saveCurrent(); intake.step = Number(button.dataset.editStep); record('review_edited'); renderIntake(true); });
}
function cleanConditional() {
  const h = intake.data.household, i = intake.data.income, d = intake.data.deductions;
  if (!['joint', 'separate'].includes(h.filingStatus)) for (const key of ['spouseFirstName', 'spouseLastName', 'spouseDob', 'spouseTaxIdLast4']) delete h[key];
  if (!i.sources?.includes('selfEmployment')) for (const key of ['businessName', 'businessType', 'grossIncome', 'businessExpenses']) delete i[key];
  if (!d.deductions?.includes('charity')) delete d.charityAmount;
}
function validateIntake() {
  const data = validate(root.querySelector('form'));
  const selection = intake.step === 2 ? data.sources : intake.step === 3 ? data.deductions : null;
  if (selection && (!selection.length || (selection.includes('none') && selection.length > 1))) fail('Select at least one option, or choose None by itself.');
  if (intake.step === 4 && data.documentPlan === 'attached' && !intake.files.length) fail('Add a sample document, or choose to provide documents later.');
  if (intake.step === 5) {
    const expected = `${intake.data.personal.firstName} ${intake.data.personal.lastName}`.replace(/\s+/g, ' ').trim().toLowerCase();
    if (data.signature.replace(/\s+/g, ' ').toLowerCase() !== expected) fail('Sign with the same first and last name entered in Personal details.');
  }
  return data;
}
function nextIntake(source = 'webmcp') {
  if (receipt) return receipt;
  validateIntake(); saveCurrent();
  if (intake.step === 5) {
    document.querySelectorAll('[data-step]').forEach(button => button.disabled = true);
    return complete('TAX', 'Your organizer is complete.', `Thank you, ${intake.data.personal.firstName}. Your ${intake.data.personal.taxYear} test intake is ready for review.`, { taxYear: intake.data.personal.taxYear, documentPlan: intake.data.documents.documentPlan }, source);
  }
  record(`step_completed:${stepKeys[intake.step]}`, source);
  intake.step++; intake.furthest = Math.max(intake.furthest, intake.step); renderIntake(true);
  return getState();
}
function goToStep(index, source = 'webmcp') {
  if (receipt) fail('The organizer is complete. Reset the sample to start again.');
  if (!Number.isInteger(index) || index < 0 || index > intake.furthest) fail('Only previously reached steps are available.');
  // Forward jumps validate every intervening step; revisiting cannot bypass requirements.
  if (index > intake.step) { while (intake.step < index) nextIntake(source); }
  else { saveCurrent(); intake.step = index; renderIntake(true); }
  return getState();
}
function addDependent(values, source = 'webmcp') {
  if (intake.step !== 1 || receipt) fail('Open the Household step to add a dependent.');
  if (intake.dependents.length >= 8) fail('This sample supports up to 8 dependents.');
  for (const key of Object.keys(values)) if (!['name', 'dob', 'relationship', 'months'].includes(key)) fail(`Unknown dependent field: ${key}`);
  for (const value of Object.values(values)) if (typeof value !== 'string') fail('Dependent fields must be strings.');
  saveCurrent(); intake.dependents.push({ ...values }); record('dependent_added', source); renderIntake();
  root.querySelector(`#dependent${intake.dependents.length - 1}Name`).focus();
  return getState();
}
function updateIntake({ step, fields, advance = false }) {
  if (receipt) fail('The organizer is already submitted.');
  if (step !== stepKeys[intake.step]) fail(`The current step is ${stepKeys[intake.step]}. Use get_scenario_state to inspect its fields.`);
  if (step === 'review' && advance) fail('Use submit_tax_intake for final submission.');
  // Process branch selectors first, exposing exactly the same dependent fields as UI changes.
  const selector = { household: 'filingStatus', income: 'sources', deductions: 'deductions' }[step];
  saveCurrent();
  const beforeData = structuredClone(intake.data);
  const beforeDependents = structuredClone(intake.dependents);
  try {
    if (selector && Object.hasOwn(fields, selector)) {
      fill(root.querySelector('form'), { [selector]: fields[selector] }); saveCurrent(); cleanConditional(); renderIntake();
    }
    fill(root.querySelector('form'), fields); saveCurrent();
  } catch (error) { intake.data = beforeData; intake.dependents = beforeDependents; renderIntake(); throw error; }
  record(`step_updated:${step}`, 'webmcp');
  return advance ? nextIntake('webmcp') : getState();
}

// Native tools: feature-detected, never polyfilled. Off mode registers none of our tools.
function getState() {
  const state = { firm: firm.slug, scenario, simulated: true, completed: Boolean(receipt), receipt, fields: formSchema() };
  if (scenario === 'tax-intake') Object.assign(state, { currentStep: stepKeys[intake.step], reachedSteps: stepKeys.slice(0, intake.furthest + 1), values: root.querySelector('form') ? formData(root.querySelector('form')) : {}, dependents: intake.dependents, requestedDocuments: requestedDocuments(), files: intake.files });
  if (scenario === 'book-meeting') Object.assign(state, { appointmentTypes: meetingTypes, timeZones: zones, calendarAnchor: dateKey(anchor), selectedSlot: booking.slot, stage: booking.stage });
  return state;
}
const objectSchema = properties => ({ type: 'object', properties, additionalProperties: false });
const string = description => ({ type: 'string', description });
const native = document.modelContext || navigator.modelContext;
const registeredNames = [];
const controller = new AbortController();
async function registerTools() {
  const status = document.querySelector('#webmcp-status');
  run.nativeAvailable = Boolean(native?.registerTool);
  if (!enabled) { run.registration = 'disabled'; status.textContent = 'Browser-only mode'; return; }
  if (!native?.registerTool) { run.registration = 'unsupported'; status.textContent = 'Native WebMCP unavailable'; return; }
  const tools = [{ name: 'get_scenario_state', description: 'Read the current fictional accounting workflow, current step, exact field schema, available choices, and completion status. Test data only.', inputSchema: objectSchema({}), execute: getState }];
  if (scenario === 'contact-me') tools.push({ name: 'submit_contact_inquiry', description: 'Complete this fictional firm contact form. Fills the visible fields, uses the same validation as the UI, and displays a simulated confirmation. No message is sent.', inputSchema: formSchema(), execute: submitContact });
  if (scenario === 'book-meeting') {
    const scheduling = { appointmentType: { type: 'string', enum: ['intro', 'tax', 'books'] }, timeZone: { type: 'string', enum: zones.map(([key]) => key) } };
    tools.push({ name: 'get_available_appointments', description: 'List available fictional appointment slots with exact UTC slotIds and local date/time labels. Optionally narrow by YYYY-MM-DD startDate/endDate. All slots are within the sample’s 60-day calendar.', inputSchema: objectSchema({ ...scheduling, startDate: string('First local date, YYYY-MM-DD'), endDate: string('Last local date, YYYY-MM-DD') }), execute: getAvailability });
    tools.push({ name: 'book_appointment', description: 'Choose a slot from get_available_appointments, fill attendee details, and confirm a simulated appointment. Same validation and visible confirmation as the UI. No real calendar event or message is created.', inputSchema: { ...objectSchema({ ...scheduling, slotId: string('Exact slotId returned by get_available_appointments'), attendee: { ...objectSchema({ firstName: string('First name'), lastName: string('Last name'), email: string('Valid email address'), phone: string('Required for phone meetings'), meetingMethod: { type: 'string', enum: ['video', 'phone'] }, notes: string('Optional meeting notes'), consent: { type: 'boolean', description: 'Must be true to confirm details' } }), required: ['firstName', 'lastName', 'email', 'meetingMethod', 'consent'] } }), required: ['appointmentType', 'timeZone', 'slotId', 'attendee'] }, execute: submitBooking });
  }
  if (scenario === 'tax-intake') {
    tools.push({ name: 'update_tax_step', description: 'Fill the current organizer step. Read get_scenario_state first for its exact field names, types, and choices. Supports conditional spouse, business, and charity fields in the same call as their selector. advance:true validates and moves to the next step, except final submission.', inputSchema: { ...objectSchema({ step: { type: 'string', enum: stepKeys }, fields: { type: 'object', description: 'Fields from the current step schema; boolean consent, arrays for sources/deductions, strings for other fields.', additionalProperties: true }, advance: { type: 'boolean' } }), required: ['step', 'fields'] }, execute: updateIntake });
    tools.push({ name: 'add_tax_dependent', description: 'Add a dependent on the Household step. Each added dependent exposes named fields in get_scenario_state. Test identities only.', inputSchema: objectSchema({ name: string('Full name'), dob: string('Date of birth, YYYY-MM-DD'), relationship: { type: 'string', enum: ['Child', 'Parent', 'Other relative'] }, months: string('Months living with taxpayer, 0 to 12') }), execute: addDependent });
    tools.push({ name: 'go_to_tax_step', description: 'Return to an already reached organizer step for review or editing. Forward navigation validates intervening steps.', inputSchema: { ...objectSchema({ step: { type: 'string', enum: stepKeys } }), required: ['step'] }, execute: ({ step }) => goToStep(stepKeys.indexOf(step)) });
    tools.push({ name: 'submit_tax_intake', description: 'At Review & submit, sign with the taxpayer’s full name and confirm review to complete the simulated organizer. All prior steps must be valid. No tax return is filed.', inputSchema: { ...objectSchema({ signature: string('Same first and last name as Personal details'), consent: { type: 'boolean', description: 'Must be true' } }), required: ['signature', 'consent'] }, execute: values => { if (receipt) return receipt; if (intake.step !== 5) fail('Complete each organizer step before submitting.'); fill(root.querySelector('form'), values); return nextIntake(); } });
  }
  try {
    for (const tool of tools) {
      await native.registerTool({ ...tool, execute: async input => {
        record(`tool:${tool.name}`, 'webmcp');
        try { return await tool.execute(input); }
        catch (error) { record(`error:${tool.name}`, 'webmcp'); showError(error); throw error; }
      } }, { signal: controller.signal });
      registeredNames.push(tool.name);
    }
    run.registration = 'ready'; status.textContent = `Native WebMCP ready · ${registeredNames.length} tools`;
  } catch {
    controller.abort();
    if (native.unregisterTool) for (const name of registeredNames) native.unregisterTool(name);
    run.registration = 'failed'; status.textContent = 'Native WebMCP registration failed';
  }
}
for (const link of document.querySelectorAll('[data-preserve-mode]')) {
  const url = new URL(link.href);
  if (!enabled) url.searchParams.set('webmcp', 'off');
  if (validAnchor) url.searchParams.set('date', parsedAnchor);
  link.href = url.pathname + url.search;
}
const modeLink = document.querySelector('#mode-link');
const modeUrl = new URL(location.href);
if (enabled) modeUrl.searchParams.set('webmcp', 'off'); else modeUrl.searchParams.delete('webmcp');
modeLink.href = modeUrl.pathname + modeUrl.search;
modeLink.textContent = enabled ? 'Switch to browser-only mode (new run)' : 'Switch to WebMCP mode (new run)';
document.querySelector('#mode-note').textContent = 'The same workflow and validation are used in both modes. A switch or reset reloads the page. Run records contain timings and actions only; no entered values. Counts describe page events, not model tokens or agent steps.';
document.querySelector('#reset-run').onclick = () => location.reload();
document.querySelector('#export-run').onclick = () => {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${firm.slug}-${scenario}-${run.mode}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
root.addEventListener('change', event => { if (event.isTrusted && event.target.name) record(`field_changed:${event.target.name}`); });
if (scenario === 'contact-me') renderContact();
else if (scenario === 'book-meeting') renderBooking();
else renderIntake();
// Harness-readable observation only; it exposes no alternate way to mutate the workflow.
Object.defineProperty(window, '__accountingBenchmark', { get: () => structuredClone(run) });
await registerTools();
window.addEventListener('pagehide', event => { if (!event.persisted) controller.abort(); });
