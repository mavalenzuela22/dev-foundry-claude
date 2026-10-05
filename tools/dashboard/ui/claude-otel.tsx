import React, { useState } from 'react';
import { Panel, Tabs, Text } from '@epam/uui';
import { useRead, shortTime, type ReadState } from './model';
import { State } from './pages';

type Measures = { inputTokens: number | null; outputTokens: number | null; cacheReadInputTokens: number | null; cacheCreationInputTokens: number | null; totalMeasuredTokens: number | null; reportedCostUsd: number | null; requestDurationMs: number | null; activeDurationMs: number | null; apiRequests: number | null };
type Session = { displayId: string; runDisplayId: string; startTime: string | null; endTime: string | null; models: string[]; measures: Measures; cacheReadRatio: number | null };
type Breakdown = Measures & { value: string; runs: number };
export type ClaudeOtelModel = {
  availability: string; summary: Measures & { runs: number | null; sessions: number | null; cacheReadRatio: number | null };
  breakdowns: Record<string, Breakdown[]>;
  recentRuns: { displayId: string; startTime: string | null; endTime: string | null; models: string[]; sessions: number | null; measures: Measures; correlation: { task: string[]; role: string[]; launchMode: string[] } }[];
  latestObservedAt: string | null; recentSessions: Session[]; recentSessionsTruncated: boolean; tasksObserved: string[]; tasksObservedTruncated: boolean;
  recentRunsTruncated: boolean; truncated: boolean; issues: { code: string; count: number }[];
  scan: { filesRead: number; candidateLines: number; records: number };
};
type MeasureMode = 'number' | 'usd' | 'ratio' | 'ms';
const number = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 20 });
const measured = (v: number | null, mode: MeasureMode = 'number') => v === null ? 'unavailable' : mode === 'usd' ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 20 })}` : mode === 'ratio' ? `${number(v)} (ratio)` : mode === 'ms' ? `${number(v)} ms` : number(v);
const compact = (v: number | null, mode: MeasureMode = 'number') => {
  if (v === null) return 'unavailable';
  if (mode === 'usd') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (mode === 'ratio') return `${(v * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
  if (mode === 'ms') {
    if (v === 0) return '0 ms';
    const [unit, divisor] = v >= 3600000 ? ['h', 3600000] : v >= 60000 ? ['m', 60000] : v >= 1000 ? ['s', 1000] : ['ms', 1];
    return `≈${(v / Number(divisor)).toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`;
  }
  return v >= 1000 ? v.toLocaleString('en-US', { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 }) : number(v);
};
const exactLabel = (caption: string, v: number | null, mode: MeasureMode = 'number') => `${caption}: ${v === null ? 'unavailable' : `${v}${mode === 'usd' ? ' USD' : mode === 'ms' ? ' ms' : mode === 'ratio' ? ' ratio' : ''}`}`;
const dimensions = [ ['model', 'Model', 'Direct measurement'], ['effort', 'Effort', 'Direct measurement'], ['querySource', 'Query source', 'Direct measurement'], ['task', 'Task', 'Exact run-id correlation'], ['role', 'Selected role', 'Exact run-id correlation'], ['launchMode', 'Launch mode', 'Exact run-id correlation'] ];
function ValueSet({ items }: { items: string[] }) {
  return items.length ? <ul className="otel-value-set">{items.map((value) => <li key={value}>{value}</li>)}</ul> : <>unavailable</>;
}
export function ClaudeOtelBreakdown({ breakdowns, dimension, onDimensionChange }: { breakdowns: ClaudeOtelModel['breakdowns']; dimension: string; onDimensionChange: (value: string) => void }) {
  const [, caption, semantics] = dimensions.find(([key]) => key === dimension) || dimensions[0];
  const rows = breakdowns[dimension] || [];
  const contextOnly = ['task', 'role', 'launchMode'].includes(dimension);
  return <Panel background="surface-main" cx="otel-breakdown">
    <Text size="24" fontWeight="600">Breakdown</Text>
    <div role="tablist" aria-label="Breakdown dimension"><Tabs cx="otel-dimension-tabs" items={dimensions.map(([id, caption]) => ({ id, caption, rawProps: { role: 'tab', id: `otel-dimension-${id}`, 'aria-controls': 'otel-breakdown-panel', 'aria-selected': id === dimension } }))} value={dimension} onValueChange={onDimensionChange} /></div>
    <section role="tabpanel" id="otel-breakdown-panel" aria-labelledby={`otel-dimension-${dimension}`} tabIndex={0}>
      <Text size="18" color="secondary">{semantics} · {contextOnly ? 'context only; consumption unavailable' : 'observed coverage'}</Text>
      {rows.length && rows.some((row) => row.value !== 'unavailable') ? <div className="otel-table-scroll"><table className="otel-table"><caption className="otel-sr-only">{caption} breakdown</caption><thead><tr><th scope="col">{caption}</th><th scope="col">Runs</th>{!contextOnly && <><th scope="col">Tokens</th><th scope="col">USD</th></>}</tr></thead><tbody>{rows.map((row) => <tr key={row.value}><th scope="row">{row.value}</th><td>{row.runs}</td>{!contextOnly && <><td title={exactLabel('Total measured tokens', row.totalMeasuredTokens)}>{measured(row.totalMeasuredTokens)}</td><td title={exactLabel('Reported USD cost', row.reportedCostUsd, 'usd')}>{measured(row.reportedCostUsd, 'usd')}</td></>}</tr>)}</tbody></table></div> : <Text color="secondary">unavailable</Text>}
    </section>
  </Panel>;
}
type MeasureEntry = [string, number | null, MeasureMode?];
function consumption(measures: Measures, ratio: number | null): MeasureEntry[] {
  return [['Reported USD cost', measures.reportedCostUsd, 'usd'], ['Total measured tokens', measures.totalMeasuredTokens], ['API requests observed', measures.apiRequests], ['Cache-read ratio', ratio, 'ratio'], ['Active duration', measures.activeDurationMs, 'ms']];
}
function components(measures: Measures): MeasureEntry[] {
  return [['Input tokens', measures.inputTokens], ['Output tokens', measures.outputTokens], ['Cache-read input tokens', measures.cacheReadInputTokens], ['Cache-creation input tokens', measures.cacheCreationInputTokens], ['Request duration', measures.requestDurationMs, 'ms']];
}
function ExactMeasures({ entries }: { entries: MeasureEntry[] }) {
  return <dl className="otel-measurements">{entries.map(([caption, value, mode]) => <div key={caption}><dt>{caption}</dt><dd title={exactLabel(caption, value, mode)}>{measured(value, mode)}</dd></div>)}</dl>;
}
function ObservedRange({ startTime, endTime }: { startTime: string | null; endTime: string | null }) {
  return <>{startTime ? <time dateTime={startTime} title={startTime}>{shortTime(startTime)}</time> : 'unavailable'} → {endTime ? <time dateTime={endTime} title={endTime}>{shortTime(endTime)}</time> : 'unavailable'}</>;
}
function SessionFacts({ session }: { session: Session }) {
  return <dl className="otel-run-context"><div><dt>Observed range</dt><dd><ObservedRange {...session} /></dd></div><div><dt>Models</dt><dd><ValueSet items={session.models} /></dd></div></dl>;
}
export function ClaudeOtelContent({ state, retry }: { state: ReadState<ClaudeOtelModel>; retry?: () => void }) {
  const [dimension, setDimension] = useState('model');
  if (state.loading) return <State loading title="Loading Claude OTEL" message="Reading bounded local telemetry." />;
  if (state.error || !state.data) return <State title="Claude OTEL unavailable" message={state.error || 'No local telemetry response is available.'} retry={retry} />;
  const model = state.data;
  const [latest, ...previous] = model.recentSessions;
  const global: MeasureEntry[] = [...consumption(model.summary, model.summary.cacheReadRatio), ['Sessions observed', model.summary.sessions], ['Telemetry runs', model.summary.runs], ...components(model.summary)];
  return <div className="claude-otel-view">
    <Panel background="surface-main" cx="otel-summary">
      <Text size="24" fontWeight="600">Claude OTEL</Text>
      <Text size="18" color="secondary">Direct measurements · local Claude telemetry</Text>
      <div className="otel-latest-observed">Latest observed telemetry: {model.latestObservedAt ? <time dateTime={model.latestObservedAt} title={model.latestObservedAt}>{shortTime(model.latestObservedAt)}</time> : 'unavailable'}</div>
      {model.availability === 'unavailable' && <State title="Claude OTEL unavailable" message="No supported telemetry runs were observed in the bounded local scan." />}
    </Panel>
    {model.availability !== 'unavailable' && <>
      <Panel background="surface-main" cx="otel-latest-session">
        <h2 className="section-heading">Latest observed session</h2>
        {latest ? <>
          <div className="otel-session-identity">Session <strong>{latest.displayId}</strong></div>
          <SessionFacts session={latest} />
          <div className="otel-kpis">{consumption(latest.measures, latest.cacheReadRatio).filter(([caption, value]) => caption !== 'Active duration' || value !== null).map(([caption, value, mode]) => <div key={caption}><Text size="18" color="secondary">{caption}</Text><div className="otel-kpi-value" title={exactLabel(caption, value, mode)} aria-label={exactLabel(caption, value, mode)}>{compact(value, mode)}</div></div>)}</div>
          <details className="otel-details"><summary>Session measurements · exact values</summary><ExactMeasures entries={[...consumption(latest.measures, latest.cacheReadRatio), ...components(latest.measures)]} /><Text size="18" color="secondary">Containing run: {latest.runDisplayId}</Text></details>
        </> : <Text color="secondary">unavailable · No valid session identifiers were observed on measurement samples. Unattributed telemetry remains in global totals.</Text>}
      </Panel>
      <Panel background="surface-main" cx="otel-session-history">
        <h2 className="section-heading">Previous sessions</h2>
        {previous.length ? <ul className="otel-session-list" aria-label="Previous Claude sessions">{previous.map((session) => <li key={`${session.runDisplayId}:${session.displayId}`} className="otel-session-card">
          <div className="otel-run-header"><div className="otel-session-identity">Session <strong>{session.displayId}</strong></div><dl className="otel-session-totals">{consumption(session.measures, session.cacheReadRatio).slice(0, 3).map(([caption, value, mode]) => <div key={caption}><dt>{caption}</dt><dd title={exactLabel(caption, value, mode)} aria-label={exactLabel(caption, value, mode)}>{compact(value, mode)}</dd></div>)}</dl></div>
          <SessionFacts session={session} />
          <details className="otel-details"><summary>Session measurements · exact values</summary><ExactMeasures entries={[...consumption(session.measures, session.cacheReadRatio), ...components(session.measures)]} /><Text size="18" color="secondary">Containing run: {session.runDisplayId}</Text></details>
        </li>)}</ul> : <Text color="secondary">No previous sessions observed.</Text>}
        {model.recentSessionsTruncated && <Text color="secondary">Session history limit reached; showing {model.recentSessions.length} newest observed sessions.</Text>}
      </Panel>
      <Panel background="surface-main" cx="otel-global-totals"><details className="otel-details"><summary>All observed telemetry · exact values</summary><ExactMeasures entries={global} /></details></Panel>
      <ClaudeOtelBreakdown breakdowns={model.breakdowns} dimension={dimension} onDimensionChange={setDimension} />
      <Panel background="surface-main" cx="otel-tasks-observed">
        <h2 className="section-heading">Tasks observed</h2>
        <ValueSet items={model.tasksObserved} />
        <Text size="18" color="secondary">Task presence is correlated at launcher-run level; per-task consumption is unavailable with the current markers.</Text>
        {model.tasksObservedTruncated && <Text color="secondary">Observed task display limit reached.</Text>}
      </Panel>
      <Panel background="surface-main" cx="otel-recent"><h2 className="section-heading">Recent runs · launcher context</h2>
        <ul className="otel-run-list" aria-label="Recent Claude telemetry runs">{model.recentRuns.map((run) => <li key={run.displayId} className="otel-run-card">
          <div className="otel-run-header"><div><Text size="18" color="secondary">Run</Text><Text size="24" fontWeight="600">{run.displayId}</Text></div><dl className="otel-run-totals"><div><dt>Total measured tokens</dt><dd title={exactLabel('Total measured tokens', run.measures.totalMeasuredTokens)}>{compact(run.measures.totalMeasuredTokens)}</dd></div><div><dt>Reported USD cost</dt><dd title={exactLabel('Reported USD cost', run.measures.reportedCostUsd, 'usd')}>{compact(run.measures.reportedCostUsd, 'usd')}</dd></div></dl></div>
          <dl className="otel-run-context"><div><dt>Observed range</dt><dd><ObservedRange {...run} /></dd></div><div><dt>Models</dt><dd><ValueSet items={run.models} /></dd></div></dl>
          <dl className="otel-run-context otel-run-correlation" aria-label="Exact run-id correlation"><div><dt>Tasks observed</dt><dd><ValueSet items={run.correlation.task} /></dd></div><div><dt>Selected-role set</dt><dd><ValueSet items={run.correlation.role} /></dd></div><div><dt>Launch mode</dt><dd><ValueSet items={run.correlation.launchMode} /></dd></div></dl>
        </li>)}</ul>
        {model.recentRunsTruncated && <Text size="18" color="secondary">Run history limit reached; showing {model.recentRuns.length} newest observed runs.</Text>}
      </Panel>
    </>}
    <details className="otel-details otel-methodology"><summary>Measurement notes &amp; scan coverage{model.truncated ? ' · Limit reached' : ''}</summary>
      <Text size="18" color="secondary">Missing values are unavailable. Task, selected role and launch mode use exact run-id correlation; run and session IDs are hashed for display.</Text>
      <Text size="18" color="secondary">Metrics are preferred independently per run or session and field; API request logs fill missing fields. Samples without a valid session identifier remain unattributed. Tokens include only measured categories. Duration sums measured activity, not elapsed time. Cache ratio requires input, cache-read and cache-creation measurements.</Text>
      <Text size="18" color="secondary">Dimension totals cover their observed samples and can differ from the summary. Task, role and launch mode rows show correlated run counts only; consumption is not allocated to these contexts.</Text>
      <Text size="18" color="secondary">{model.scan.filesRead} files · {model.scan.candidateLines} candidate lines · {model.scan.records} OTLP / operation records considered{model.truncated ? ' · Scan or display limit reached; totals cover considered evidence only.' : ''}</Text>
    </details>
    {!!model.issues.length && <details className="otel-issues"><summary>Parse / scan issues ({model.issues.reduce((sum, issue) => sum + issue.count, 0)})</summary>{model.issues.map((issue) => <Text key={issue.code} size="18" color="secondary">{issue.code} · {issue.count}</Text>)}</details>}
  </div>;
}
export function ClaudeOtel({ revision, retry }: { revision: number; retry: () => void }) { return <ClaudeOtelContent state={useRead<ClaudeOtelModel>('claude-otel', revision)} retry={retry} />; }
