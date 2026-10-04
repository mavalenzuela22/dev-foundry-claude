import React, { useState } from 'react';
import { FlexRow, LinkButton, Panel, Tabs, Text } from '@epam/uui';
import { fullTime, label, titles, useRead, type Kind, type ReadState, type RecordModel } from './model';
import { evidenceLabel, RecordStatus, State } from './pages';

function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return <div><Text size="18" color="secondary">{name}</Text><Text size="24">{children}</Text></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Panel background="surface-main" cx="detail-section"><h2 className="section-heading">{title}</h2>{children}</Panel>;
}
function Technical({ record }: { record: RecordModel }) {
  return <Section title="Technical"><dl className="technical-facts"><div><dt>Record ID</dt><dd>{record.recordId}</dd></div><div><dt>Evidence location</dt><dd>{record.source}</dd></div>
    {Object.entries(record.facts || {}).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{String(value)}</dd></div>)}</dl>
    {record.raw !== undefined && <details><summary>Generated evidence{record.rawTruncated ? ' · bounded excerpt' : ''}</summary><pre>{record.raw}</pre></details>}
  </Section>;
}
function Execution({ record }: { record: RecordModel }) {
  const [tab, setTab] = useState('summary');
  const captions = ['Summary', 'Live output', 'Evidence', 'Artifacts', 'Technical'];
  const keys = ['summary', 'live-output', 'evidence', 'artifacts', 'technical'];
  return <><DetailTabs scope="execution" captions={captions} keys={keys} tab={tab} setTab={setTab} /><section role="tabpanel" id="execution-panel" aria-labelledby={`execution-tab-${tab}`} tabIndex={0}>
    {tab === 'summary' && <Section title="Summary"><div className="execution-timing fact-grid"><Fact name="Started">{fullTime(String(record.facts?.startedAt || '') || null)}</Fact><Fact name="Finished">{fullTime(String(record.facts?.finishedAt || '') || null)}</Fact><Fact name="Duration">{typeof record.facts?.durationMs === 'number' ? `${Math.round(record.facts.durationMs / 1000)} s` : 'Not recorded'}</Fact></div><div className="fact-grid"><Fact name="Executor">{record.executor || 'Unknown'}</Fact><Fact name="Origin">Local durable execution</Fact></div><Text size="18" color="secondary">Recorded · {fullTime(record.time)}</Text></Section>}
    {tab === 'live-output' && <Section title="Live output"><Text>No live output source is available for this local dashboard.</Text></Section>}
    {tab === 'evidence' && <Section title="Evidence"><dl className="technical-facts"><div><dt>Execution status</dt><dd>{record.issue ? 'Unavailable' : 'Available'}</dd></div><div><dt>Completeness</dt><dd>{record.evidenceComplete === true ? 'Complete' : record.evidenceComplete === false ? 'Incomplete' : 'Not stated'}</dd></div></dl></Section>}
    {tab === 'artifacts' && <Section title="Artifacts and content"><Text>No artifact content is projected by this durable-record source.</Text></Section>}
    {tab === 'technical' && <Technical record={record} />}
  </section></>;
}
function Validation({ record }: { record: RecordModel }) {
  return <><Section title="Summary"><div className="fact-grid"><div><Text size="18" color="secondary">Verdict</Text><RecordStatus record={record} size="24" /></div></div></Section>
    <Section title="Timing"><div className="fact-grid">{['createdAt', 'queuedAt', 'startedAt', 'finishedAt', 'interruptedAt'].map((key) => <Fact key={key} name={label(key)}>{fullTime(String(record.facts?.[key] || '') || null)}</Fact>)}</div></Section>
    <Section title="Evidence and failures"><div className="fact-grid"><Fact name="Evidence">{evidenceLabel(record)}</Fact><Fact name="Failures">{record.failureCount ?? 0}</Fact><Fact name="Errors">{record.errorCount ?? 0}</Fact><Fact name="Issue">{record.issue || 'None recorded'}</Fact></div></Section><details className="secondary-detail"><summary>Technical identifiers</summary><Technical record={record} /></details>
  </>;
}
function DetailTabs({ scope, captions, keys, tab, setTab }: { scope: string; captions: string[]; keys: string[]; tab: string; setTab: (value: string) => void }) {
  const items = keys.map((id, index) => ({ id, caption: captions[index], isActive: tab === id, rawProps: { role: 'tab', id: `${scope}-tab-${id}`, 'aria-controls': `${scope}-panel`, 'aria-selected': tab === id } }));
  return <Tabs items={items} value={tab} onValueChange={setTab} size="30" cx="detail-tabs" />;
}
function Transaction({ record }: { record: RecordModel }) {
  const [tab, setTab] = useState('lifecycle');
  const transaction = record.transaction;
  return <><FlexRow columnGap="12" cx="transaction-next"><Fact name="Next required action">{record.nextRequiredAction ? label(record.nextRequiredAction) : 'None disclosed'}</Fact><Text size="18" color="secondary">{record.issue ? 'Invalid record' : 'Valid record'}</Text></FlexRow>
    {transaction?.truncated && <Text size="18" color="secondary">Bounded detail: up to 64 entries per section; additional recorded entries are omitted.</Text>}
    <DetailTabs scope="transaction" captions={['Lifecycle', 'Findings', 'Observed facts', 'Technical']} keys={['lifecycle', 'findings', 'facts', 'technical']} tab={tab} setTab={setTab} />
    <section role="tabpanel" id="transaction-panel" aria-labelledby={`transaction-tab-${tab}`} tabIndex={0}>
      {tab === 'lifecycle' && <Section title="Ordered lifecycle phases">{transaction?.phases.length ? <ol className="lifecycle">{transaction.phases.map((phase, index) => <li key={index}><FlexRow columnGap="12" cx="phase-row"><Text size="24">{phase.name ? label(phase.name) : 'Name unavailable'}</Text><RecordStatus record={{ ...record, issue: null, status: phase.status }} /></FlexRow></li>)}</ol> : <Text>No phases disclosed.</Text>}</Section>}
      {tab === 'findings' && <Section title="Findings">{transaction?.findings.length ? transaction.findings.map((finding, index) => <div key={index} className="finding"><Text size="24" fontWeight="600">{finding.code || 'No code'} · {finding.severity || 'Unspecified'}</Text><Text>{finding.message || 'No message disclosed'}</Text></div>) : <Text>No findings disclosed.</Text>}</Section>}
      {tab === 'facts' && <Section title="Observed facts">{transaction?.observedFacts.length ? <dl className="technical-facts">{transaction.observedFacts.map((fact, index) => <div key={index}><dt>{label(fact.name || 'Fact')}</dt><dd>{fact.value === null ? 'Not disclosed' : String(fact.value)}</dd></div>)}</dl> : <Text>No observed facts disclosed.</Text>}</Section>}
      {tab === 'technical' && <><Technical record={record} /><Section title="Side-effect boundaries">{transaction?.boundaries.length ? <ul>{transaction.boundaries.map((boundary, index) => <li key={index}>{label(boundary)}</li>)}</ul> : <Text>None disclosed.</Text>}</Section></>}
    </section>
  </>;
}
export function DetailContent({ kind, state, retry, returnTo }: { kind: Kind; state: ReadState<RecordModel>; retry?: () => void; returnTo?: string }) {
  const name = kind === 'executions' ? 'Execution' : kind === 'validations' ? 'Validation' : 'Transaction';
  const record = state.data;
  const target = returnTo || `/${kind}`;
  const [pathname, search] = target.split('?');
  return <Panel background="surface-main" cx="record-detail"><LinkButton caption={`← Back to ${titles[kind]}`} link={{ pathname, search: search ? `?${search}` : '' }} size="30" />
    <header className="detail-header"><Text size="18" color="secondary">{name} detail</Text><div className="detail-title"><h1 className="page-heading">{kind === 'transactions' ? 'Repository transaction' : record?.taskId || name}</h1>{record && <RecordStatus record={record} size="24" />}</div></header>
    {state.loading ? <State loading title="Loading detail" message={`Reading local ${name.toLowerCase()} evidence.`} /> : state.error ? <State title={`${name} unavailable`} message={state.error} retry={retry} /> : record && <>
      {record.issue && <Text size="18" color="secondary">{record.issue}</Text>}
      {kind === 'executions' ? <Execution record={record} /> : kind === 'validations' ? <Validation record={record} /> : <Transaction record={record} />}
    </>}
  </Panel>;
}
export function Detail({ kind, ids, revision, retry, returnTo }: { kind: Kind; ids: string[]; revision: number; retry: () => void; returnTo?: string }) {
  return <DetailContent kind={kind} state={useRead<RecordModel>(`${kind}/${ids.join('/')}`, revision)} retry={retry} returnTo={returnTo} />;
}
