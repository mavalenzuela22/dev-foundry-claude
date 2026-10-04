import { useEffect, useState } from 'react';
export type Kind = 'executions' | 'validations' | 'transactions';
export type RecordModel = {
  id: string; kind: Kind; recordId: string; taskId: string | null; status: string | null;
  time: string | null; source: string; issue: string | null;
  executor?: string | null; evidenceComplete?: boolean | null; label?: string | null; nextRequiredAction?: string | null;
  requestId?: string; executionId?: string | null; validationId?: string; validationVerdict?: string | null;
  evidenceAvailable?: boolean | null; failureCount?: number; errorCount?: number;
  createdAt?: string; queuedAt?: string; startedAt?: string; finishedAt?: string; interruptedAt?: string;
  facts?: Record<string, string | number | boolean>; raw?: string; rawTruncated?: boolean;
  transaction?: { truncated?: boolean; phases: { name: string | null; status: string | null }[]; findings: { severity: string | null; code: string | null; message: string | null }[]; observedFacts: { name: string | null; value: string | number | boolean | null }[]; boundaries: string[] };
};
export type ListModel = { records: RecordModel[]; truncated: boolean; issues: string[]; availability: string };
export type ReadState<T> = { loading: boolean; data?: T; error?: string };
export type Health = { data: Record<Kind, { records: number; recordIssues: number; issues: string[]; truncated: boolean }> };
export const titles: Record<Kind, string> = { executions: 'Executions', validations: 'Validations', transactions: 'Transactions' };
export const shortTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fullTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
export const statusColor = (status: string | null | undefined): 'success' | 'critical' | 'warning' | 'info' => {
  if (['passed', 'pass', 'completed'].includes(status || '')) return 'success';
  if (['failed', 'fail', 'error'].includes(status || '')) return 'critical';
  return ['blocked', 'pending', 'running', 'incomplete'].includes(status || '') ? 'warning' : 'info';
};
export const label = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
export function useRead<T>(endpoint: string, revision = 0): ReadState<T> {
  const [state, setState] = useState<ReadState<T>>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    fetch(`/api/dashboard/v1/${endpoint}`, { signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      return body as T;
    }).then((data) => { if (!controller.signal.aborted) setState({ loading: false, data }); })
      .catch((error: Error) => { if (!controller.signal.aborted) setState({ loading: false, error: error.message }); });
    return () => controller.abort();
  }, [endpoint, revision]);
  return state;
}
