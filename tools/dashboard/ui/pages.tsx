import React, { useState } from 'react';
import { useArrayDataSource, type DataColumnProps } from '@epam/uui-core';
import { Anchor, Button, DataTable, DataTableRow, FlexRow, FlexSpacer, LinkButton, Panel, Paginator, SearchInput, Spinner, StatusIndicator, Tabs, Text } from '@epam/uui';
import { ClaudeOtel } from './claude-otel';
import { recordPath, telemetryTabPath } from './routes.mjs';
import { label, shortTime, statusColor, titles, useRead, type Kind, type ListModel, type ReadState, type RecordModel } from './model';

export function State({ title, message, retry, loading = false }: { title: string; message: string; retry?: () => void; loading?: boolean }) {
  return <Panel background="surface-main" cx="empty-panel" rawProps={{ role: 'status' }}>
    {loading && <Spinner />}
    <Text size="24" fontWeight="600">{title}</Text><Text color="secondary">{message}</Text>
    {retry && <Button caption="Retry" onClick={retry} size="30" />}
  </Panel>;
}
export function RecordStatus({ record, size = '18', verdictSeparator = ' / ' }: { record: RecordModel; size?: '18' | '24'; verdictSeparator?: string }) {
  const caption = record.kind === 'validations' && record.validationVerdict ? `${record.status}${verdictSeparator}${record.validationVerdict}` : record.status || 'Unavailable';
  return <StatusIndicator size={size} caption={record.issue ? 'Unavailable · issue' : caption} color={record.issue ? 'warning' : statusColor(record.validationVerdict || record.status)} />;
}
export const evidenceLabel = (record: RecordModel) => (record.failureCount || 0) > 0 ? `${record.failureCount} failures` : record.evidenceComplete ? 'Complete' : record.evidenceAvailable ? 'Linked' : 'Unavailable';
function Issues({ model }: { model?: ListModel }) {
  return <>{!!model?.issues.length && <Text size="18" color="secondary">{model.issues.join(' · ')}</Text>}
    {model?.truncated && <Text size="18" color="secondary">Scan limit reached; newest within scanned records. Global total unknown.</Text>}</>;
}
function LoadNotice({ state, retry, empty }: { state: ReadState<unknown>; retry?: () => void; empty?: string }) {
  return state.loading ? <State loading title="Loading evidence" message="Reading local durable records." /> : state.error ? <State title="Evidence unavailable" message={state.error} retry={retry} /> : <State title="No records yet" message={empty || 'No supported durable records are available in this source.'} />;
}

function Latest({ kind, state, retry }: { kind: 'executions' | 'validations'; state: ReadState<ListModel>; retry: () => void }) {
  const record = state.data?.records[0];
  const caption = kind === 'executions' ? 'Latest execution' : 'Latest validation';
  return <section className="snapshot-latest" aria-label={caption}>
    <h2 className="category-heading">{caption}</h2><Issues model={state.data} />
    {record ? <><FlexRow columnGap="12" cx="primary-record"><Text size="24" fontWeight="600">{record.taskId || 'Task unavailable'}</Text><RecordStatus record={record} /></FlexRow>
      {kind === 'executions' ? <div className="overview-facts"><Text size="18" color="secondary">Executor · {record.executor || '—'}</Text><Text size="18" color="secondary">Observed · {shortTime(record.time)}</Text></div>
        : <Text size="18" color="secondary">Created · {shortTime(record.time)}</Text>}{record.issue && <Text size="18" color="secondary">{record.issue}</Text>}</> : <LoadNotice state={state} retry={state.error ? retry : undefined} />}
  </section>;
}
function Earlier({ kind, state }: { kind: 'executions' | 'validations'; state: ReadState<ListModel> }) {
  const caption = `Earlier ${kind}`;
  return <section className={`snapshot-history history-${kind}`} aria-label={caption}><h2 className="section-heading">{caption}</h2>
    {state.data?.records.slice(1, 5).map((record) => <FlexRow key={record.id} columnGap="12" cx="history-record"><div><Text size="none">{record.taskId || 'Task unavailable'}</Text><Text size="18" color="secondary">{kind === 'executions' ? `${record.executor || '—'} · ` : ''}{shortTime(record.time)}</Text></div><RecordStatus record={record} /></FlexRow>)}
    {!state.loading && !state.error && !state.data?.records.slice(1).length && <Text size="18" color="secondary">No earlier {kind} available.</Text>}
  </section>;
}
export function OverviewContent({ executions, validations, retry = () => undefined }: { executions: ReadState<ListModel>; validations: ReadState<ListModel>; retry?: () => void }) {
  return <div className="overview"><h1 className="page-heading">Overview</h1><Panel background="surface-main" cx="snapshot-cockpit">
    <div className="snapshot-intro"><h2 className="section-heading">Operational snapshot</h2><Text size="18" color="secondary">Latest execution and validation activity</Text></div>
    <Latest kind="executions" state={executions} retry={retry} /><Latest kind="validations" state={validations} retry={retry} />
    <Earlier kind="executions" state={executions} /><Earlier kind="validations" state={validations} />
  </Panel></div>;
}
export function Overview({ revision, retry }: { revision: number; retry: () => void }) {
  return <OverviewContent executions={useRead<ListModel>('executions', revision)} validations={useRead<ListModel>('validations', revision)} retry={retry} />;
}

// Search is intentionally limited to the current unfiltered page. Pagination counts
// the bounded durable records, not a synthetic global search result.
export function pageRecords(records: RecordModel[], page: number, search: string, kind: Kind) {
  const current = records.slice((page - 1) * 20, page * 20);
  const query = search.toLowerCase();
  return current.filter((record) => (kind === 'transactions'
    ? `${record.label || 'Repository transaction'} ${record.status || ''} ${record.nextRequiredAction || ''}`
    : `${record.taskId || ''} ${record.status || ''} ${kind === 'executions' ? record.executor || '' : record.validationVerdict || ''}`).toLowerCase().includes(query));
}
function RecordLink({ record, transaction = false }: { record: RecordModel; transaction?: boolean }) {
  return <Anchor href={recordPath(record)} cx="record-link"><Text size="none">{transaction ? record.label || 'Repository transaction' : record.taskId || 'Task unavailable'}</Text></Anchor>;
}
export function DurableTable({ records, kind }: { records: RecordModel[]; kind: Kind }) {
  const source = useArrayDataSource<RecordModel, string, unknown>({ items: records, getId: (record) => record.id }, [records]);
  const view = source.useView({}, () => undefined, {});
  const task: DataColumnProps<RecordModel, string> = { key: 'task', caption: 'Task', width: kind === 'executions' ? 115 : 110, grow: 1, render: (record) => <RecordLink record={record} /> };
  const status: DataColumnProps<RecordModel, string> = { key: 'status', caption: kind === 'validations' ? 'Status / verdict' : 'Status', width: kind === 'validations' ? 120 : 100, render: (record) => <RecordStatus record={record} verdictSeparator=" · " /> };
  const time: DataColumnProps<RecordModel, string> = { key: 'time', caption: 'Time', width: 105, render: (record) => <Text size="none">{shortTime(record.time)}</Text> };
  let columns: DataColumnProps<RecordModel, string>[];
  if (kind === 'executions') columns = [task, status, { key: 'executor', caption: 'Executor', width: 90, render: (record) => <Text size="none">{record.executor || 'unknown'}</Text> }, time];
  else if (kind === 'validations') columns = [task, status, { key: 'evidence', caption: 'Evidence', width: 110, render: (record) => <Text size="none">{evidenceLabel(record)}</Text> }, time];
  else columns = [{ key: 'transaction', caption: 'Transaction', width: 140, grow: 1, render: (record) => <RecordLink record={record} transaction /> }, status, time, { key: 'next', caption: 'Next action', width: 120, render: (record) => <Text size="none">{record.nextRequiredAction ? label(record.nextRequiredAction) : '—'}</Text> }];
  return <div className="durable-table"><DataTable {...view.getListProps()} value={{}} onValueChange={() => undefined} getRows={() => view.getVisibleRows()} renderRow={({ key, ...props }) => <DataTableRow key={key} {...props} size="36" columnsGap="12" cx="compact-table-row" />} columns={columns.map((column) => ({ ...column, alignSelf: 'center' }))} size="36" headerTextCase="upper" columnsGap="12" disableVirtualization /></div>;
}
export function DurableListContent({ kind, state, retry }: { kind: Kind; state: ReadState<ListModel>; retry?: () => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const records = state.data?.records || [];
  const totalPages = Math.max(1, Math.ceil(records.length / 20));
  const currentPage = Math.min(page, totalPages);
  const filtered = pageRecords(records, currentPage, search, kind);
  const placeholder = kind === 'transactions' ? 'Search this page by label or status…' : 'Search this page by task or status…';
  return <Panel background="surface-main" cx="durable-list"><FlexRow padding="12" vPadding="12"><Text size="24" fontWeight="600">{titles[kind]}</Text></FlexRow>
    <SearchInput value={search} onValueChange={(value) => setSearch((value || '').slice(0, 500))} disableDebounce placeholder={placeholder} rawProps={{ 'aria-label': `Search ${kind} on current page` }} />
    <Issues model={state.data} />
    {state.loading || state.error || !records.length ? <LoadNotice state={state} retry={state.error ? retry : undefined} /> : filtered.length ? <DurableTable kind={kind} records={filtered} /> : <State title="No matches" message="No rows on this page match the current search." />}
    <FlexRow padding="12" vPadding="12" columnGap="12" cx="list-footer"><Text size="18" color="secondary">{state.data ? `${records.length} records in considered candidates${state.data.truncated ? ' · Scan limit reached; global total unknown' : ''}` : 'Reading records…'}</Text><FlexSpacer /><Paginator value={currentPage} onValueChange={setPage} totalPages={totalPages} size="24" isDisabled={state.loading || !!state.error} /></FlexRow>
  </Panel>;
}
export function DurableList({ kind, revision, retry }: { kind: Kind; revision: number; retry: () => void }) {
  return <DurableListContent kind={kind} state={useRead<ListModel>(kind, revision)} retry={retry} />;
}

export function Telemetry({ tab = 'throughput', revision, retry }: { tab?: string; revision: number; retry: () => void }) {
  const active = tab;
  const tabs = ['Throughput', 'Claude OTEL', 'Transactions'].map((caption) => {
    const id = caption.toLowerCase().replace(' ', '-');
    return { id, caption, isActive: id === active, rawProps: { role: 'tab', id: `telemetry-tab-${id}`, 'aria-controls': 'telemetry-panel', 'aria-selected': id === active } };
  });
  return <Panel background="surface-main" cx="telemetry"><Text size="30" fontWeight="600">Telemetry / Diagnostics</Text>
    <Tabs items={tabs} value={active} onValueChange={(value) => { window.history.pushState(null, '', telemetryTabPath(value)); window.dispatchEvent(new PopStateEvent('popstate')); }} />
    <section role="tabpanel" id="telemetry-panel" aria-labelledby={`telemetry-tab-${active}`} tabIndex={0}>
      {active === 'claude-otel' ? <ClaudeOtel revision={revision} retry={retry} /> : active === 'transactions' ? <DurableList kind="transactions" revision={revision} retry={retry} /> : <Panel background="surface-main"><Text size="24" fontWeight="600">Throughput</Text><Text color="secondary">No live call throughput source is configured for this local dashboard.</Text><Text>Throughput unavailable.</Text></Panel>}
    </section>
  </Panel>;
}
export function LiveUnavailable({ detail }: { detail: boolean }) {
  return <Panel background="surface-main" cx={detail ? 'record-detail' : 'live-surface'}>
    {detail ? <><LinkButton caption="← Back to Live Activity" link={{ pathname: '/calls' }} size="30" /><h1 className="page-heading">Call</h1></> : <FlexRow padding="12" vPadding="12"><Text size="24" fontWeight="600">Live Activity</Text></FlexRow>}
    <State title={detail ? 'Call unavailable' : 'Live Activity unavailable'} message="No live call observation source is available for this local dashboard." />
  </Panel>;
}
