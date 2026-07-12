'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendRequest {
  to?: string;
  recipients?: string[];
  listName?: string;
  template: string;
  data?: Record<string, unknown>;
  text?: string;
  buttons?: string[];
  scheduleAt?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface NotifyState {
  loading:    boolean;
  error:      string | null;
  lastResult: unknown;
}

export interface NotifyContextValue {
  send:       (req: SendRequest) => Promise<unknown>;
  sendBulk:   (req: Omit<SendRequest, 'to'> & { recipients: string[] }) => Promise<unknown>;
  sendToList: (listName: string, req: Omit<SendRequest, 'to' | 'recipients'>) => Promise<unknown>;
  optIn:      (phone: string) => Promise<unknown>;
  optOut:     (phone: string) => Promise<unknown>;
  mute:       (phone: string, durationMs: number) => Promise<unknown>;
  state:      NotifyState;
  reset:      () => void;
}

const NotifyContext = createContext<NotifyContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface NotifyProviderProps {
  children: React.ReactNode;
  /** Base URL of your Next.js API route. Default: '/api/notify' */
  apiBase?: string;
}

export function NotifyProvider({
  children,
  apiBase = '/api/notify',
}: NotifyProviderProps) {
  const [state, setState] = useState<NotifyState>({
    loading: false, error: null, lastResult: null,
  });

  const reset = useCallback(() => {
    setState({ loading: false, error: null, lastResult: null });
  }, []);

  const call = useCallback(
    async (path: string, body: unknown): Promise<unknown> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`${apiBase}${path}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({ message: res.statusText }));
          throw new Error((payload as { message?: string }).message ?? 'Request failed');
        }

        const result = await res.json();
        setState((s) => ({ ...s, loading: false, lastResult: result }));
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, loading: false, error: msg }));
        throw err;
      }
    },
    [apiBase]
  );

  const value: NotifyContextValue = {
    send:       (req)                   => call('/send',      req),
    sendBulk:   (req)                   => call('/send-bulk', req),
    sendToList: (listName, req)         => call('/send-bulk', { ...req, listName }),
    optIn:      (phone)                 => call('/opt-in',    { phone }),
    optOut:     (phone)                 => call('/opt-out',   { phone }),
    mute:       (phone, durationMs)     => call('/mute',      { phone, durationMs }),
    state,
    reset,
  };

  return (
    <NotifyContext.Provider value={value}>
      {children}
    </NotifyContext.Provider>
  );
}

// ── useNotify ─────────────────────────────────────────────────────────────────

export function useNotify(): NotifyContextValue {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    throw new Error('[Notify] useNotify must be used inside <NotifyProvider>');
  }
  return ctx;
}

// ── useOptIn ──────────────────────────────────────────────────────────────────

export function useOptIn(phone?: string) {
  const { optIn, optOut, state, reset } = useNotify();
  const [optedIn, setOptedIn] = useState(false);

  const handleOptIn = useCallback(
    async (p?: string) => {
      const target = p ?? phone;
      if (!target) throw new Error('Phone number required');
      await optIn(target);
      setOptedIn(true);
    },
    [optIn, phone]
  );

  const handleOptOut = useCallback(
    async (p?: string) => {
      const target = p ?? phone;
      if (!target) throw new Error('Phone number required');
      await optOut(target);
      setOptedIn(false);
    },
    [optOut, phone]
  );

  return { optIn: handleOptIn, optOut: handleOptOut, optedIn, ...state, reset };
}

// ── useBulkSend ───────────────────────────────────────────────────────────────

export interface BulkSendState {
  loading:  boolean;
  error:    string | null;
  sent:     number;
  failed:   number;
  skipped:  number;
  total:    number;
  broadcastId: string | null;
}

export function useBulkSend() {
  const { sendBulk, sendToList } = useNotify();

  const [bulkState, setBulkState] = useState<BulkSendState>({
    loading: false, error: null,
    sent: 0, failed: 0, skipped: 0, total: 0, broadcastId: null,
  });

  const sendToRecipients = useCallback(
    async (recipients: string[], opts: Omit<SendRequest, 'to' | 'recipients'>) => {
      setBulkState({
        loading: true, error: null,
        sent: 0, failed: 0, skipped: 0, total: recipients.length, broadcastId: null,
      });
      try {
        const result = (await sendBulk({ recipients, ...opts })) as {
          broadcastId: string; sent: number; failed: number; skipped: number; total: number;
        };
        setBulkState((s) => ({
          ...s,
          loading:     false,
          sent:        result.sent,
          failed:      result.failed,
          skipped:     result.skipped,
          broadcastId: result.broadcastId,
        }));
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setBulkState((s) => ({ ...s, loading: false, error: msg }));
        throw err;
      }
    },
    [sendBulk]
  );

  const sendToNamedList = useCallback(
    async (listName: string, opts: Omit<SendRequest, 'to' | 'recipients'>) => {
      setBulkState({
        loading: true, error: null,
        sent: 0, failed: 0, skipped: 0, total: 0, broadcastId: null,
      });
      try {
        const result = (await sendToList(listName, opts)) as {
          broadcastId: string; sent: number; failed: number; skipped: number; total: number;
        };
        setBulkState((s) => ({
          ...s, loading: false,
          sent: result.sent, failed: result.failed, skipped: result.skipped,
          total: result.total, broadcastId: result.broadcastId,
        }));
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setBulkState((s) => ({ ...s, loading: false, error: msg }));
        throw err;
      }
    },
    [sendToList]
  );

  return { sendToRecipients, sendToNamedList, ...bulkState };
}
