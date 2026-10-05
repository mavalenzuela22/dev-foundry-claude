import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserHistory, createMemoryHistory } from 'history';
import { HistoryAdaptedRouter, UuiContext, useUuiServices } from '@epam/uui-core';
import { MainMenu } from '@epam/loveship';
import { MainMenuLogo } from '@epam/uui-components';
import { DropdownMenuBody, DropdownMenuButton, FlexRow, MainMenuButton, MainMenuDropdown, Panel, StatusIndicator } from '@epam/uui';
import '@epam/uui-components/styles.css';
import '@epam/uui/styles.css';
import '@epam/loveship/styles.css';
import { menu, parseRoute, telemetryTab } from './routes.mjs';
import { useRead, type Health, type Kind } from './model';
import { DurableList, LiveUnavailable, Overview, State, Telemetry } from './pages';
import { Detail } from './details';
import './style.css';

const history = typeof window === 'undefined' ? createMemoryHistory() : createBrowserHistory();
const router = new HistoryAdaptedRouter(history);
function Dashboard({ initialPath }: { initialPath?: string }) {
  const [location, setLocation] = useState(initialPath || (typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search));
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision((value) => value + 1);
  const health = useRead<Health>('health', revision);
  useEffect(() => history.listen((next) => setLocation(next.pathname + next.search)), []);
  useEffect(() => {
    const onPop = () => setLocation(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [path, query] = location.split('?');
  const route = parseRoute(path);
  const selected = route.section === 'transactions' ? '/telemetry' : route.section === 'overview' ? '/' : `/${route.section}`;
  const items = useMemo(() => [
    { id: 'logo', priority: 100, render: () => <MainMenuLogo key="logo" href="/" logoUrl="/logo.svg" rawProps={{ className: 'product-logo', 'aria-label': 'dev-foundry-claude overview' }} /> },
    ...menu.map((item, index) => ({ id: item.path, priority: index < 3 ? 3 : 1, render: () => <MainMenuButton key={item.path} caption={item.caption} link={{ pathname: item.path }} isActive={selected === item.path} /> })),
    { id: 'more', priority: 100, collapsedContainer: true, render: (_item: unknown, hidden: { id: string }[] = []) => <MainMenuDropdown key="more" caption="More" isActive={hidden.some((item) => item.id === selected)} renderBody={(props) => <DropdownMenuBody {...props}>{hidden.map((item) => { const entry = menu.find((entry) => entry.path === item.id); return entry && <DropdownMenuButton key={entry.path} caption={entry.caption} link={{ pathname: entry.path }} isActive={selected === entry.path} onClick={props.onClose} />; })}</DropdownMenuBody>} /> },
  ], [selected]);
  const issues = health.data ? Object.values(health.data.data).some((data) => data.recordIssues || data.issues.length || data.truncated) : false;
  const caption = health.loading ? 'Reading local evidence' : health.error ? 'Local evidence unavailable' : issues ? 'Local evidence available · issues / bounds' : 'Local durable evidence available';
  let content: React.ReactNode;
  if (route.section === 'overview') content = <Overview revision={revision} retry={retry} />;
  else if (route.section === 'calls') content = <LiveUnavailable detail={!!route.ids.length} />;
  else if (route.section === 'telemetry') content = <Telemetry tab={telemetryTab(query)} revision={revision} retry={retry} />;
  else if (['executions', 'validations', 'transactions'].includes(route.section)) {
    content = route.ids.length ? <Detail key={path} kind={route.section as Kind} ids={route.ids} revision={revision} retry={retry} returnTo={route.section === 'transactions' && typeof document !== 'undefined' && document.referrer.includes('/telemetry') ? '/telemetry?tab=transactions' : undefined} /> : <DurableList key={route.section} kind={route.section as Kind} revision={revision} retry={retry} />;
  } else content = <State title="Page unavailable" message="This route is not part of the local operations dashboard." />;
  return <div className="uui-theme-loveship dashboard"><header><MainMenu items={items} /><div className="status-strip"><Panel background="surface-main"><FlexRow padding="12" columnGap="12" cx="connection-row" rawProps={{ role: 'status' }}><StatusIndicator size="18" color={health.error ? 'critical' : health.loading || issues ? 'warning' : 'success'} caption={caption} /></FlexRow></Panel></div></header><main>{content}</main></div>;
}
export function App({ initialPath }: { initialPath?: string }) { const { services } = useUuiServices({ router }); return <UuiContext.Provider value={services}><Dashboard initialPath={initialPath} /></UuiContext.Provider>; }
if (typeof document !== 'undefined') createRoot(document.getElementById('root')!).render(<App />);
