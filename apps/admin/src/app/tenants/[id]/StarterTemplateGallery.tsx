'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Send } from 'lucide-react';
import {
  STARTER_GROUPS, STARTER_TEMPLATES, defaultGroupForCategory, renderStarterPreview,
  type StarterGroup, type StarterTemplate,
} from '@/lib/starterTemplates';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  APPROVED: 'default',
  PENDING:  'secondary',
  REJECTED: 'destructive',
};

/**
 * Fixed to WhatsApp's own colors regardless of theme, same rationale as
 * WhatsAppPreview: the point is fidelity to the recipient's screen.
 */
function StarterPreview({ tpl }: { tpl: StarterTemplate }) {
  return (
    <div className="flex-1 p-3.5" style={{ background: '#e5ddd5' }}>
      <div className="max-w-[95%] rounded-lg rounded-tl-none bg-white p-2.5 shadow-sm">
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-snug text-neutral-900">
          {renderStarterPreview(tpl)}
        </p>
        <div className="mt-1 text-right text-[10px] text-neutral-400">10:02</div>
      </div>
      {tpl.buttons && tpl.buttons.length > 0 && (
        <div className="mt-1.5 grid max-w-[95%] gap-1">
          {tpl.buttons.map((b) => (
            <div
              key={b.text}
              className="rounded-lg bg-white py-1.5 text-center text-[12px] font-medium shadow-sm"
              style={{ color: '#027eb5' }}
            >
              {b.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StarterTemplateGallery({
  apiBase, tenantCategory, existingStatuses, credentialsReady,
}: {
  apiBase: string;
  tenantCategory: string | null;
  /** wa_templates name → status, to mark starters that are already submitted. */
  existingStatuses: Record<string, string>;
  /** false until credentials incl. WABA ID are saved — submits are disabled with a hint. */
  credentialsReady: boolean;
}) {
  const router = useRouter();
  // Plain controlled buttons, not Base UI Tabs — this tree mounts inside a
  // hidden setup tab, exactly the case Tabs' defaultValue silently breaks on.
  const [group, setGroup] = useState<StarterGroup>(defaultGroupForCategory(tenantCategory));
  const [submitting, setSubmitting] = useState<string | null>(null);

  const visible = STARTER_TEMPLATES.filter((t) => t.group === group);

  const handleSubmit = async (tpl: StarterTemplate) => {
    setSubmitting(tpl.key);
    try {
      const res = await fetch(`${apiBase}/templates/starter`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: tpl.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      toast.success(
        data.status === 'APPROVED'
          ? `“${tpl.label}” was approved instantly — ready to send`
          : `“${tpl.label}” submitted — Meta usually reviews within a day`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitleGroup
          icon={Sparkles}
          title="Starter templates"
          description="Pre-drafted messages you can submit to WhatsApp in one click — no copywriting, no WhatsApp Manager."
        />
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {STARTER_GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGroup(g.value)}
              className={
                g.value === group
                  ? 'rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-primary-foreground'
                  : 'rounded-full border border-border px-3.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground'
              }
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((tpl) => {
            const existingStatus = existingStatuses[tpl.key];
            return (
              <div key={tpl.key} className="flex flex-col overflow-hidden rounded-lg border border-border shadow-xs">
                <StarterPreview tpl={tpl} />
                <div className="flex flex-col gap-2.5 border-t border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{tpl.label}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {tpl.metaCategory === 'MARKETING' ? 'Marketing' : 'Utility'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fills in: {tpl.paramLabels.join(', ').toLowerCase()}
                  </p>
                  {existingStatus ? (
                    <Badge variant={STATUS_VARIANT[existingStatus] ?? 'outline'} className="w-fit">
                      {existingStatus === 'APPROVED' ? 'Approved — ready to send' : existingStatus}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      disabled={!credentialsReady || submitting !== null}
                      onClick={() => handleSubmit(tpl)}
                    >
                      {submitting === tpl.key ? <Loader2 className="animate-spin" /> : <Send />}
                      {submitting === tpl.key ? 'Submitting…' : 'Submit to WhatsApp'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!credentialsReady && (
          <p className="mt-4 text-xs text-muted-foreground">
            Submitting needs saved credentials including a Business Account ID — complete the Credentials step first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
