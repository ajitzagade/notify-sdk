'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ImageIcon, Megaphone, Plus, Loader2, Play } from 'lucide-react';
import type { BroadcastListRecord } from '@/lib/broadcastLists';
import type { TemplateRecord } from '@/lib/templates';
import type { CampaignRecord, HeaderMediaType } from '@/lib/campaigns';
import type { MediaAssetRecord } from '@/lib/media';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { WhatsAppPreview } from '@/components/whatsapp-preview';
import { toast } from '@/lib/toast';

function bodyText(template: TemplateRecord): string {
  return template.components.find((c) => c.type === 'BODY')?.text ?? '';
}

function placeholderCount(text: string): number {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return matches.length ? Math.max(...matches) : 0;
}

/** A template's approved HEADER component format, if it has a media header — 'image' | 'video' | 'document' — or null for a text/no header. */
function headerMediaType(template: TemplateRecord): HeaderMediaType | null {
  const header = template.components.find((c) => c.type === 'HEADER');
  const format = header?.format?.toUpperCase();
  if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') return format.toLowerCase() as HeaderMediaType;
  return null;
}

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  draft:     'outline',
  running:   'secondary',
  completed: 'default',
  failed:    'destructive',
};

export function CampaignsPanel({
  tenantId,
  tenantName,
  lists,
  templates,
  campaigns,
  mediaAssets,
  baseApiPath,
  mediaUploadHint = "upload one from the Test Send tab first",
}: {
  tenantId: string;
  tenantName: string;
  lists: BroadcastListRecord[];
  templates: TemplateRecord[];
  campaigns: CampaignRecord[];
  mediaAssets: MediaAssetRecord[];
  /** Defaults to the admin console's own API — pass '/api/portal' to run this panel inside the tenant portal instead. */
  baseApiPath?: string;
  mediaUploadHint?: string;
}) {
  const apiBase = baseApiPath ?? `/api/tenants/${tenantId}`;
  const router = useRouter();
  const [name, setName]                 = useState('');
  const [listId, setListId]             = useState('');
  const [templateId, setTemplateId]     = useState('');
  const [params, setParams]             = useState<string[]>([]);
  const [headerAssetId, setHeaderAssetId] = useState('');
  const [creating, setCreating]         = useState(false);
  const [runningId, setRunningId]       = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const paramCount       = useMemo(() => (selectedTemplate ? placeholderCount(bodyText(selectedTemplate)) : 0), [selectedTemplate]);
  const requiredHeader   = selectedTemplate ? headerMediaType(selectedTemplate) : null;
  const matchingAssets   = useMemo(
    () => (requiredHeader ? mediaAssets.filter((a) => a.kind === requiredHeader) : []),
    [requiredHeader, mediaAssets]
  );
  const headerAsset = matchingAssets.find((a) => a.id === headerAssetId) ?? null;

  const filledBody = useMemo(() => {
    if (!selectedTemplate) return '';
    const template = bodyText(selectedTemplate);
    return template.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] || `{{${n}}}`);
  }, [selectedTemplate, params]);

  const selectTemplate = (id: string | null) => {
    setTemplateId(id ?? '');
    const t = templates.find((x) => x.id === id);
    setParams(t ? new Array(placeholderCount(bodyText(t))).fill('') : []);
    setHeaderAssetId('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    if (requiredHeader && !headerAsset) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/campaigns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          broadcastListId: listId,
          hsmTemplateName: selectedTemplate.name,
          hsmLanguage:     selectedTemplate.language,
          hsmParams:       params,
          headerMediaType: requiredHeader ?? undefined,
          headerMediaUrl:  headerAsset?.blobUrl ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create campaign');
      toast.success(`Campaign "${name}" created as a draft`);
      setName('');
      setListId('');
      setTemplateId('');
      setParams([]);
      setHeaderAssetId('');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (campaignId: string, campaignName: string) => {
    setRunningId(campaignId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/campaigns/${campaignId}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Run failed');
      const stats = data.result;
      toast.success(
        stats ? `Sent ${stats.sent ?? 0}, failed ${stats.failed ?? 0}, skipped ${stats.skipped ?? 0}` : 'Campaign sent',
        `"${campaignName}" ran`
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setRunningId(null);
    }
  };

  const canCreate = !creating && listId && templateId && params.every((p) => p.trim()) && (!requiredHeader || headerAsset);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns</CardTitle>
        <CardDescription>
          Broadcast a Meta-approved template to an entire list. Only members who&apos;ve opted in will actually receive it —
          everyone else is counted as skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {lists.length === 0 || templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Megaphone className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Not ready to run a campaign yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {lists.length === 0 && 'Import contacts into a list above. '}
                {templates.length === 0 && 'Sync WhatsApp templates from the Templates tab.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <form id="create-campaign-form" onSubmit={handleCreate} className="grid gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input id="campaign-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Broadcast list</Label>
              <Select value={listId} onValueChange={(v) => setListId(v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a list…" /></SelectTrigger>
                <SelectContent>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.memberCount} members)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={selectTemplate}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.language}) — {t.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {requiredHeader && (
              <div className="grid gap-2">
                <Label>
                  Header {requiredHeader} <span className="font-normal text-muted-foreground">— this template requires one</span>
                </Label>
                {matchingAssets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No {requiredHeader} assets in this tenant&apos;s media library yet — {mediaUploadHint}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {matchingAssets.map((asset) => (
                      <Button
                        key={asset.id}
                        type="button"
                        variant={headerAssetId === asset.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHeaderAssetId(asset.id)}
                        title={asset.originalFilename ?? asset.blobUrl}
                      >
                        {asset.originalFilename ?? asset.id.slice(0, 8)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {params.map((val, i) => (
              <div key={i} className="grid gap-2">
                <Label htmlFor={`campaign-param-${i}`}>{`{{${i + 1}}}`}</Label>
                <Input
                  id={`campaign-param-${i}`}
                  required
                  value={val}
                  onChange={(e) => {
                    const next = [...params];
                    next[i] = e.target.value;
                    setParams(next);
                  }}
                />
              </div>
            ))}
          </form>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Preview</span>
            <WhatsAppPreview
              senderName={tenantName}
              body={selectedTemplate ? filledBody : undefined}
              mediaUrl={requiredHeader ? headerAsset?.blobUrl : undefined}
              mediaKind={requiredHeader ?? undefined}
              caption={requiredHeader ? filledBody : undefined}
            />
          </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Megaphone className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No campaigns yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one above to broadcast to a list.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {c.hsmTemplateName}
                        {c.headerMediaUrl && <ImageIcon className="size-3.5 text-muted-foreground" aria-label={`with ${c.headerMediaType}`} />}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {runningId === c.id ? (
                        <Progress value={null} className="w-32" />
                      ) : c.stats ? (
                        'error' in c.stats
                          ? `Error: ${c.stats.error}`
                          : `Sent ${c.stats.sent} · Failed ${c.stats.failed} · Skipped ${c.stats.skipped} · Total ${c.stats.total}`
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                        {c.status === 'draft' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRun(c.id, c.name)}
                            disabled={runningId === c.id}
                          >
                            {runningId === c.id ? <Loader2 className="animate-spin" /> : <Play />}
                            {runningId === c.id ? 'Running…' : 'Run'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {lists.length > 0 && templates.length > 0 && (
        <CardFooter>
          <Button type="submit" form="create-campaign-form" disabled={!canCreate}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            {creating ? 'Creating…' : 'Create campaign'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
