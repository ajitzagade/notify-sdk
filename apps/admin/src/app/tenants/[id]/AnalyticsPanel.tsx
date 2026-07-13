'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertCircle, Send, CheckCheck, Eye, XCircle as XCircleIcon, MessageSquareReply, BarChart3 } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TenantRollup, CampaignLiveStats } from '@/lib/analytics';
import type { CampaignRecord } from '@/lib/campaigns';

type CampaignWithLiveStats = CampaignRecord & { live: CampaignLiveStats | null };

interface AnalyticsResponse {
  rollup: TenantRollup;
  campaigns: CampaignWithLiveStats[];
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
  icon: Icon, label, value, sub,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums leading-tight">{value.toLocaleString()}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
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

export function AnalyticsPanel({ tenantId }: { tenantId: string }) {
  const [data, setData]       = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/analytics`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load analytics');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const { rollup, campaigns } = data ?? { rollup: null, campaigns: [] };

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
                  <StatCard icon={Send} label="Sent" value={rollup.sent} />
                  <StatCard icon={CheckCheck} label="Delivered" value={rollup.delivered} sub={`${pct(rollup.deliveryRate)} of sent`} />
                  <StatCard icon={Eye} label="Read" value={rollup.read} sub={`${pct(rollup.readRate)} of delivered`} />
                  <StatCard icon={XCircleIcon} label="Failed" value={rollup.failed} />
                  <StatCard icon={MessageSquareReply} label="Replies" value={rollup.replies} sub={`${pct(rollup.replyRate)} of sent`} />
                </div>

                <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3 sm:gap-6">
                  <RateBar label="Delivery rate" fraction={rollup.deliveryRate} color="var(--primary)" />
                  <RateBar label="Read rate" fraction={rollup.readRate} color="var(--signal)" />
                  <RateBar label="Reply rate" fraction={rollup.replyRate} color="var(--chart-3)" />
                </div>
              </>
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
