import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readRecords } from '../server/evidence.mjs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let ui;
const target = new URL('../node_modules/.cache/dashboard-render-proof.cjs', import.meta.url);
before(async () => {
  await mkdir(new URL('../node_modules/.cache/', import.meta.url), { recursive: true });
  const result = await build({ stdin: { contents: `
    import React from 'react';
    import { createMemoryHistory } from 'history';
    import { HistoryAdaptedRouter, UuiContext, useUuiServices } from '@epam/uui-core';
    export { App } from './main';
    export { OverviewContent, DurableListContent, DurableTable, pageRecords, Telemetry } from './pages';
    export { DetailContent } from './details';
    const router = new HistoryAdaptedRouter(createMemoryHistory());
    export function Provider({ children }) { const { services } = useUuiServices({ router }); return <UuiContext.Provider value={services}>{children}</UuiContext.Provider>; }
  `, resolveDir: fileURLToPath(new URL('../ui/', import.meta.url)), loader: 'tsx' }, bundle: true, external: ['react', 'react-dom', 'react-dom/*'], format: 'cjs', platform: 'node', loader: { '.css': 'empty' }, write: false });
  await writeFile(target, result.outputFiles[0].text);
  ui = await import(target.href);
});
after(() => unlink(target));
const render = (component, props) => renderToStaticMarkup(React.createElement(ui.Provider, null, React.createElement(component, props)));
const makeRecord = (kind, index = 1) => ({ kind, id: `record-${index}`, recordId: `local-${index}`, taskId: `TSK-${index}`, status: kind === 'validations' ? 'pass' : 'passed', time: '2026-10-03T12:00:00Z', source: `.dev-foundry/${kind}/local-${index}/status.json`, issue: null, executor: 'codex-cli', evidenceComplete: true, label: 'Local branch operation', nextRequiredAction: 'await_authorized_next_phase' });
const ready = (kind) => ({ loading: false, data: { records: Array.from({ length: 3 }, (_, index) => makeRecord(kind, index + 1)), truncated: false, issues: [], availability: 'available' } });
const textOnly = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');

test('all ten contract routes render the UUI shell and truthful initial states', () => {
  const routes = [
    ['/', 'Overview'], ['/calls', 'Live Activity unavailable'], ['/calls/call-1', 'Call unavailable'],
    ['/executions', 'Loading evidence'], ['/executions/TSK-014/run-1', 'Loading detail'],
    ['/validations', 'Loading evidence'], ['/validations/check-1', 'Loading detail'],
    ['/telemetry', 'Throughput unavailable'], ['/transactions', 'Loading evidence'], ['/transactions/tx-1', 'Loading detail'],
  ];
  for (const [route, caption] of routes) {
    const html = render(ui.App, { initialPath: route });
    assert.ok(html.includes(caption), `${route}: ${caption}`);
    assert.ok(html.includes('dev-foundry-claude'));
    assert.ok(html.includes('uui-mainmenu-container'));
    assert.ok(!html.includes('Refresh'), `${route}: rejected refresh control`);
  }
});

test('shell uses the native logo slot with zero horizontal inset at every breakpoint', async () => {
  const html = render(ui.App, { initialPath: '/' });
  const menu = html.slice(0, html.indexOf('status-strip'));
  const captions = ['Overview', 'Live Activity', 'Executions', 'Validations', 'Telemetry'];
  const positions = captions.map((caption) => menu.indexOf(`>${caption}<`));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])), 'Primary menu order is unchanged');
  assert.match(html, /class="[^"]*product-logo/);
  assert.ok(html.includes('/logo.svg'));
  const css = await readFile(new URL('../ui/style.css', import.meta.url), 'utf8');
  const slotRules = [...css.matchAll(/\.product-logo\s*\{([^}]+)\}/g)].map((match) => match[1]);
  assert.equal(slotRules.length, 1, 'No mobile override may reintroduce logo inset');
  assert.match(slotRules[0], /margin:\s*0\s*;/);
  assert.match(slotRules[0], /padding:\s*0\s*;/);
  assert.match(css, /\.product-logo img\s*\{[^}]*width:\s*112px;[^}]*height:\s*40px;/);
  const source = await readFile(new URL('../ui/main.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('MainMenuLogo'));
  assert.ok(!source.includes('MainMenuCustomElement'));
  assert.ok(source.includes('collapsedContainer: true'), 'Official More collapse API');
  assert.ok(source.includes('hidden.some'), 'More indicates the hidden active section');
});

test('Overview renders the exact heading order inside one full-width cockpit', async () => {
  const html = render(ui.OverviewContent, { executions: ready('executions'), validations: ready('validations') });
  const headings = [...html.matchAll(/<h[12][^>]*>(.*?)<\/h[12]>/g)].map((match) => textOnly(match[1]));
  assert.deepEqual(headings, ['Overview', 'Operational snapshot', 'Latest execution', 'Latest validation', 'Earlier executions', 'Earlier validations']);
  assert.equal((html.match(/snapshot-cockpit/g) || []).length, 1);
  assert.ok(html.indexOf('snapshot-cockpit') < html.indexOf('Operational snapshot'));
  assert.match(html, /<h1[^>]*>Overview<\/h1>/);
  for (const rejected of ['summary-card', 'summary-grid', 'recent-grid', 'Producer-local operations', 'Records in bounded view', 'Recent executions', 'Recent validations']) assert.ok(!html.includes(rejected), rejected);
  const css = await readFile(new URL('../ui/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.snapshot-cockpit\s*\{[^}]*flex-direction:\s*column;/);
  assert.ok(!/summary-grid|recent-grid/.test(css));
  assert.ok(html.includes('codex-cli'));
  assert.ok(html.includes('TSK-1'));
});

test('Overview latest and history task labels are plain text while list navigation remains linked', () => {
  const html = render(ui.OverviewContent, { executions: ready('executions'), validations: ready('validations') });
  const sections = [...html.matchAll(/<section[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length, 4);
  for (const [, caption, content] of sections) {
    assert.doesNotMatch(content, /<a\b/, caption);
    assert.doesNotMatch(content, /record-link/, caption);
    const tasks = [...content.matchAll(/>TSK-(\d+)</g)].map((match) => Number(match[1]));
    assert.deepEqual(tasks, caption.startsWith('Latest') ? [1] : [2, 3], caption);
  }
  for (const kind of ['executions', 'validations']) {
    const list = render(ui.DurableListContent, { kind, state: ready(kind) });
    assert.match(list, new RegExp(`<a[^>]*href="/${kind}/[^\"]+"[^>]*>[\\s\\S]*?>TSK-1<`));
  }
});

test('Overview execution facts form one two-row grid; validation time is labelled Created', async () => {
  const html = render(ui.OverviewContent, { executions: ready('executions'), validations: ready('validations') });
  const execution = html.match(/aria-label="Latest execution"[^>]*>([\s\S]*?)<\/section>/)[1];
  const validation = html.match(/aria-label="Latest validation"[^>]*>([\s\S]*?)<\/section>/)[1];
  const facts = execution.match(/<div class="overview-facts">(<[^>]+>Executor · [^<]*<\/[^>]+>)(<[^>]+>Observed · [^<]*<\/[^>]+>)<\/div>/);
  assert.ok(facts, 'Both execution facts must be siblings inside the same grid');
  assert.equal((html.match(/class="overview-facts"/g) || []).length, 1);
  assert.equal(textOnly(facts[1]), 'Executor · codex-cli');
  const time = new Date(makeRecord('executions').time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  assert.equal(textOnly(facts[2]), `Observed · ${time}`);
  assert.ok(textOnly(validation).includes(`Created · ${time}`));
  assert.doesNotMatch(html, /Recorded ·/);
  assert.doesNotMatch(validation, /Executor ·|Observed ·|overview-facts/);

  // The observed 158px region used an 8px sibling gap between these facts.
  // Only that gap becomes 4px; retain the surrounding cockpit/region spacing.
  // This proves the CSS contract, not browser visual acceptance.
  const css = await readFile(new URL('../ui/style.css', import.meta.url), 'utf8');
  const factsRules = [...css.matchAll(/\.overview-facts\s*\{([^}]+)\}/g)];
  assert.equal(factsRules.length, 1, 'No breakpoint override changes the internal row gap');
  assert.match(factsRules[0][1], /display:\s*grid;\s*gap:\s*4px;/);
  assert.doesNotMatch(factsRules[0][1], /height|padding|margin|position/);
  assert.match(css, /\.snapshot-latest\s*\{[^}]*padding:\s*12px;[^}]*border:\s*1px solid[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*8px;/);
  assert.match(css, /\.snapshot-cockpit\s*\{[^}]*padding:\s*16px;[^}]*gap:\s*12px;/);
  assert.match(css, /\.overview\s*\{[^}]*padding:\s*16px;[^}]*display:\s*grid;[^}]*gap:\s*16px;/);
});

test('Overview retains unavailable facts, recorded issues and states without inventing values', () => {
  const state = (kind) => ({ loading: false, data: { ...ready(kind).data, records: [{ ...makeRecord(kind), taskId: null, executor: null, time: null, status: null, issue: 'Malformed local record' }] } });
  const html = render(ui.OverviewContent, { executions: state('executions'), validations: state('validations') });
  const text = textOnly(html);
  for (const fact of ['Task unavailable', 'Executor · —', 'Observed · —', 'Created · —', 'Unavailable · issue', 'Malformed local record']) assert.ok(text.includes(fact), fact);
  assert.doesNotMatch(text, /codex-cli|passed|2026/);
  assert.doesNotMatch(html, /<a\b/);
});

test('durable list columns, search, compact table and footer hierarchy match each reference list', () => {
  const cases = [
    ['executions', ['Task', 'Status', 'Executor', 'Time']],
    ['validations', ['Task', 'Status / verdict', 'Evidence', 'Time']],
    ['transactions', ['Transaction', 'Status', 'Time', 'Next action']],
  ];
  for (const [kind, columns] of cases) {
    const html = render(ui.DurableListContent, { kind, state: ready(kind) });
    const headers = [...html.matchAll(/<[^>]*role="columnheader"[^>]*>(.*?)<\/div>/g)].map((match) => textOnly(match[1]));
    assert.deepEqual(headers, columns, `${kind}: columns`);
    assert.ok(html.indexOf(kind === 'executions' ? 'Executions' : kind === 'validations' ? 'Validations' : 'Transactions') < html.indexOf('<input'));
    assert.ok(html.indexOf('<input') < html.indexOf('role="columnheader"'));
    assert.ok(html.indexOf('role="columnheader"') < html.indexOf('list-footer'));
    assert.ok(html.includes('3 records in considered candidates'));
    assert.ok(html.includes('Search this page by'));
    assert.ok(html.includes('uui-paginator'));
    assert.equal((html.match(/<input/g) || []).length, 1, 'One full-width current-page search');
    assert.ok(html.includes('uui-size-36'), 'Compact 36px table rows');
    for (const rejected of ['Refresh', 'All states', 'Read-only local durable evidence', 'bounded view', 'Recorded time', '>Record<', 'toolbar']) assert.ok(!html.includes(rejected), `${kind}: ${rejected}`);
  }
});

test('all durable kinds share explicit UUI DataTableRow rendering with compact cell alignment', async (t) => {
  const errors = t.mock.method(console, 'error', () => undefined);
  const warnings = t.mock.method(console, 'warn', () => undefined);
  const source = await readFile(new URL('../ui/pages.tsx', import.meta.url), 'utf8');
  assert.match(source, /import\s*\{[^}]*\bDataTableRow\b[^}]*\}\s*from '@epam\/uui'/);
  assert.match(source, /renderRow=\{\(\{ key, \.\.\.props \}\) => <DataTableRow key=\{key\} \{\.\.\.props\} size="36" columnsGap="12" cx="compact-table-row" \/>\}/);
  assert.equal((source.match(/<DataTable\s/g) || []).length, 1, 'One shared durable table implementation');
  assert.equal((source.match(/<DurableTable\s/g) || []).length, 1, 'All list kinds use the shared renderer');
  assert.match(source, /<DurableTable kind=\{kind\} records=\{filtered\} \/>/);

  for (const kind of ['executions', 'validations', 'transactions']) {
    const records = ready(kind).data.records;
    const direct = render(ui.DurableTable, { kind, records });
    const list = render(ui.DurableListContent, { kind, state: ready(kind) });
    for (const html of [direct, list]) {
      const rows = [...html.matchAll(/<div\b([^>]*\bclass="[^"]*\bcompact-table-row\b[^"]*"[^>]*)>/g)];
      assert.equal(rows.length, records.length, `${kind}: each data row uses the compact renderer`);
      for (const [, attributes] of rows) {
        assert.match(attributes, /role="row"/, `${kind}: compact class belongs to the UUI row`);
        assert.match(attributes, /\buui-table-row\b/, `${kind}: native UUI row composition`);
        assert.match(attributes, /\buui-size-36\b/, `${kind}: row size is preserved`);
      }
      assert.equal((html.match(/role="cell"/g) || []).length, records.length * 4, `${kind}: four cells per row`);
    }
    assert.ok(textOnly(list).includes(textOnly(direct)), `${kind}: list preserves shared table headers and row content`);
  }
  assert.equal(errors.mock.callCount(), 0, 'Explicit row rendering adds no React errors');
  assert.equal(warnings.mock.callCount(), 0, 'Explicit row rendering adds no React warnings');

  const css = await readFile(new URL('../ui/style.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/\.compact-table-row\s+\[role="cell"\]\s*\{([^}]+)\}/g)];
  assert.equal(rules.length, 1, 'One compact-row alignment rule');
  assert.equal(rules[0][1].trim(), 'align-items: center;', 'Alignment comes from UUI row composition without pixel padding overrides');
});

test('current-page search never pulls matching records from another page or changes page totals', () => {
  const records = Array.from({ length: 25 }, (_, index) => makeRecord('executions', index + 1));
  assert.equal(ui.pageRecords(records, 1, 'TSK-25', 'executions').length, 0);
  assert.equal(ui.pageRecords(records, 2, 'TSK-25', 'executions')[0].taskId, 'TSK-25');
  assert.equal(ui.pageRecords(records, 2, '', 'executions').length, 5);
  assert.equal(ui.pageRecords(records, 1, 'passed', 'executions').length, 20);
});

test('Telemetry has the diagnostics surface, ordered tabs and labelled tabpanel; transactions also stand alone', () => {
  for (const [path, selected] of [['/telemetry', 'throughput'], ['/telemetry?tab=transactions', 'transactions']]) {
    const html = render(ui.App, { initialPath: path });
    assert.ok(html.includes('Telemetry / Diagnostics'));
    const panel = html.indexOf('class="telemetry');
    assert.ok(html.indexOf('Telemetry / Diagnostics', panel) < html.indexOf('role="tablist"', panel));
    assert.ok(html.indexOf('telemetry-tab-throughput') < html.indexOf('telemetry-tab-transactions'));
    assert.match(html, new RegExp(`role="tabpanel"[^>]*id="telemetry-panel"[^>]*aria-labelledby="telemetry-tab-${selected}"`));
  }
  const standalone = render(ui.App, { initialPath: '/transactions' });
  assert.ok(!standalone.includes('Telemetry / Diagnostics'));
  assert.ok(!standalone.includes('telemetry-tab-throughput'));
});

test('compact single-status shell has no refresh, badge or parallel status clusters; body stack is frozen', async () => {
  const html = render(ui.App, { initialPath: '/' });
  const shell = html.slice(0, html.indexOf('<main>'));
  const statusElements = [...shell.matchAll(/class="([^"]*)"/g)].filter((match) => match[1].split(/\s+/).includes('uui-status_indicator'));
  assert.equal(statusElements.length, 1);
  for (const rejected of ['Refresh', 'Reconnect', 'read only', 'read-only', 'Live source unavailable']) assert.ok(!shell.includes(rejected), rejected);
  const css = await readFile(new URL('../ui/style.css', import.meta.url), 'utf8');
  assert.match(css, /body\s*\{[^}]*font-family:\s*Inter, Arial, sans-serif;/);
  assert.match(css, /\.connection-row\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*min-height:\s*36px;/);
  assert.match(css, /\.status-strip\s*\{\s*padding:\s*12px 16px 0;/);
});

test('each durable detail uses its reference-specific hierarchy without generic refresh or payload panels', () => {
  for (const kind of ['executions', 'validations', 'transactions']) {
    const record = { ...makeRecord(kind), facts: { startedAt: '2026-10-03T11:00:00Z', finishedAt: '2026-10-03T12:00:00Z' }, transaction: { phases: [{ name: 'preflight', status: 'completed' }], findings: [], observedFacts: [], boundaries: [] } };
    const html = render(ui.DetailContent, { kind, state: { loading: false, data: record } });
    assert.ok(html.includes(`Back to ${kind[0].toUpperCase() + kind.slice(1)}`));
    assert.match(html, new RegExp(`<a[^>]*href="/${kind}"`), 'Detail back navigation remains linked');
    assert.ok(html.includes('<h1'));
    assert.ok(!html.includes('Refresh'));
    if (kind === 'executions') { for (const caption of ['Summary', 'Live output', 'Evidence', 'Artifacts', 'Technical']) assert.ok(html.includes(caption)); }
    if (kind === 'validations') { for (const caption of ['Summary', 'Timing', 'Evidence and failures', 'Technical identifiers']) assert.ok(html.includes(caption)); }
    if (kind === 'transactions') { for (const caption of ['Repository transaction', 'Lifecycle', 'Findings', 'Observed facts', 'Technical', 'Ordered lifecycle phases']) assert.ok(html.includes(caption)); }
  }
});

test('list pagination and footer derive from validated projections with twenty rows on the first page', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dashboard-pagination-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const kind of ['executions', 'validations']) {
    const operation = kind === 'executions' ? 'execution' : 'validation';
    const directory = path.join(root, `.dev-foundry/${operation}-requests/requests`);
    await mkdir(directory, { recursive: true });
    for (let index = 1; index <= 22; index++) {
      const requestId = `${kind === 'executions' ? 'req' : 'valreq'}_${index.toString(16).padStart(32, '0')}`;
      const data = { schemaVersion: `foundry-runner.${operation}-request.v1`, requestId, taskId: `TSK-${index}`, status: index === 22 ? 'invalid' : 'queued', createdAt: '2026-10-03T12:00:00Z', ...(kind === 'validations' ? { validationId: `check-${index}` } : { executionId: `execution-${index}` }) };
      await writeFile(path.join(directory, requestId + '.json'), JSON.stringify(data));
    }
    const model = await readRecords(root, kind);
    assert.equal(model.records.length, 21);
    assert.equal(ui.pageRecords(model.records, 1, '', kind).length, 20);
    assert.equal(ui.pageRecords(model.records, 2, '', kind).length, 1);
    const html = render(ui.DurableListContent, { kind, state: { loading: false, data: model } });
    assert.ok(html.includes('21 records in considered candidates'));
    assert.doesNotMatch(html, /records in scanned candidates/);
    const links = [...html.matchAll(/<a[^>]*href="\/(executions|validations)\//g)];
    assert.equal(links.length, 20, 'Default table page holds twenty projected records');
    const footer = html.slice(html.indexOf('list-footer'));
    const pages = [...footer.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((match) => textOnly(match[1])).filter(Boolean);
    assert.deepEqual(pages, ['1', '2'], 'Paginator uses projected rows rather than scanned files');
  }
});

test('validation verdict, aggregate failures and all recorded timing remain visible', () => {
  const record = { ...makeRecord('validations'), status: 'interrupted', validationVerdict: 'fail', evidenceAvailable: true, evidenceComplete: false, failureCount: 2, errorCount: 1, facts: { createdAt: '2026-10-03T12:00:00Z', queuedAt: '2026-10-03T12:01:00Z', startedAt: '2026-10-03T12:02:00Z', finishedAt: '2026-10-03T12:03:00Z', interruptedAt: '2026-10-03T12:04:00Z' } };
  const html = render(ui.DurableListContent, { kind: 'validations', state: { loading: false, data: { ...ready('validations').data, records: [record] } } });
  assert.ok(html.includes('interrupted · fail'));
  assert.ok(html.includes('2 failures'));
  assert.ok(!html.includes('interrupted / fail'));
  const detail = textOnly(render(ui.DetailContent, { kind: 'validations', state: { loading: false, data: record } }));
  for (const caption of ['queued At', 'interrupted At', 'Failures2', 'Errors1']) assert.ok(detail.includes(caption), caption);
});

test('validation list renders dot captions and evidence priority from governed request projections', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dashboard-validation-caption-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, '.dev-foundry/validation-requests/requests');
  await mkdir(directory, { recursive: true });
  const cases = [
    { taskId: 'TSK-009', status: 'failed', validationVerdict: 'fail', evidenceComplete: true, evidenceLocation: 'linked', failureReasons: ['failed check'], errorCodes: ['VALIDATION_FAILED'] },
    { taskId: 'TSK-010', status: 'passed', validationVerdict: 'pass', evidenceComplete: true },
    { taskId: 'TSK-011', status: 'passed', validationVerdict: 'pass', evidenceComplete: false, evidenceLocation: 'linked' },
    { taskId: 'TSK-012', status: 'queued', evidenceComplete: false },
  ];
  for (let index = 0; index < cases.length; index++) {
    const requestId = `valreq_${index.toString(16).padStart(32, '0')}`;
    await writeFile(path.join(directory, `${requestId}.json`), JSON.stringify({ schemaVersion: 'foundry-runner.validation-request.v1', requestId, validationId: `check-${index}`, createdAt: `2026-10-03T12:0${index}:00Z`, ...cases[index] }));
  }
  const model = await readRecords(root, 'validations');
  assert.equal(model.records.find((record) => record.taskId === 'TSK-009').failureCount, 2);
  const html = textOnly(render(ui.DurableListContent, { kind: 'validations', state: { loading: false, data: model } }));
  for (const [task, caption] of [['TSK-009', 'failed · fail2 failures'], ['TSK-010', 'passed · passComplete'], ['TSK-011', 'passed · passLinked'], ['TSK-012', 'queuedUnavailable']]) assert.ok(html.includes(`${task}${caption}`), `${task}: ${caption}`);
  assert.doesNotMatch(html, /failed \/ fail|passed \/ pass|Incomplete/);
});

test('execution table renders unknown when the projection has no trustworthy executor', () => {
  const record = { ...makeRecord('executions'), executor: null };
  const html = textOnly(render(ui.DurableTable, { kind: 'executions', records: [record] }));
  assert.ok(html.includes('unknown'));
  assert.ok(!html.includes('codex-cli'));
});
