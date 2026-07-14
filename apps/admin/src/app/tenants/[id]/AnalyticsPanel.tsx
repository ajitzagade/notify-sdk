'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertCircle, Send, CheckCheck, Eye, XCircle as XCircleIcon, MessageSquareReply, BarChart3 } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActivityChart } from '@/components/activity-chart';
import type { TenantRollup, CampaignLiveStats, DailyActivity } from '@/lib/analytics';
import type { CampaignRecord } from '@/lib/campaigns';

type CampaignWithLiveStats = CampaignRecord & { live: CampaignLiveStats | null };

interface AnalyticsResponse {
  rollup: TenantRollup;
  campaigns: CampaignWithLiveStats[];
  daily: DailyActivity[];
}

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  draft:     'outline',
  running:   'secondary',
  completed: 'default',
  failed:    'destructive',
};

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function StatCard({
  icon: Icon, label, value, sub, accent = 'var(--muted-foreground)', delay = 0,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string; accent?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg border-l-2 bg-card p-4 shadow-xs"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums leading-tight">{value.toLocaleString()}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}

function RateBar({ label, fraction, color }: { label: string; fraction: number; color: string }) {
  const value = Math.round(fraction * 100);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium tabular-nums">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

export function AnalyticsPanel({ tenantId, baseApiPath }: { tenantId: string; baseApiPath?: string }) {
  const apiBase = baseApiPath ?? `/api/tenants/${tenantId}`;
  const [data, setData]       = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/analytics`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load analytics');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  const { rollup, campaigns, daily } = data ?? { rollup: null, campaigns: [], daily: [] };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics</CardTitle>
        <CardDescription>
          Live counts from every message this tenant has sent — recomputed on every refresh, not a cached snapshot.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && !data ? (
          <AnalyticsSkeleton />
        ) : (
          <>
            {rollup && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <StatCard icon={Send} label="Sent" value={rollup.sent} accent="var(--primary)" delay={0} />
                  <StatCard icon={CheckCheck} label="Delivered" value={rollup.delivered} sub={`${pct(rollup.deliveryRate)} of sent`} accent="var(--signal)" delay={0.04} />
                  <StatCard icon={Eye} label="Read" value={rollup.read} sub={`${pct(rollup.readRate)} of delivered`} accent="var(--chart-3)" delay={0.08} />
                  <StatCard icon={XCircleIcon} label="Failed" value={rollup.failed} accent="var(--destructive)" delay={0.12} />
                  <StatCard icon={MessageSquareReply} label="Replies" value={rollup.replies} sub={`${pct(rollup.replyRate)} of sent`} accent="var(--primary-2)" delay={0.16} />
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3 sm:gap-6"
                >
                  <RateBar label="Delivery rate" fraction={rollup.deliveryRate} color="var(--primary)" />
                  <RateBar label="Read rate" fraction={rollup.readRate} color="var(--signal)" />
                  <RateBar label="Reply rate" fraction={rollup.replyRate} color="var(--chart-3)" />
                </motion.div>
              </>
            )}

            {daily.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-lg border bg-card p-4"
              >
                <div className="mb-3 text-sm font-medium">Activity — last 14 days</div>
                <ActivityChart data={daily} />
              </motion.div>
            )}

            <div>
              <div className="mb-3 text-sm font-medium">Campaign performance</div>
              {campaigns.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                    <BarChart3 className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No campaigns run yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Run one from the Campaigns page and its stats will show up here live.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Read</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead className="text-right">Replies</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.live?.sent ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.live?.delivered ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.live?.read ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.live?.failed ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.live?.replies ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
