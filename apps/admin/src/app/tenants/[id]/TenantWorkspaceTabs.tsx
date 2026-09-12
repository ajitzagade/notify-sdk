'use client';

import { useState } from 'react';
import {
  LayoutGrid, ListChecks, BarChart3, Sparkles, UserRound, Webhook, History, Workflow,
  Palette, ShieldCheck, LayoutTemplate, Send, KeyRound, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const WORKSPACE_TABS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'analytics',     label: 'Analytics',     icon: BarChart3 },
  { value: 'ai',            label: 'AI assistant',  icon: Sparkles },
  { value: 'automation',    label: 'Automation',    icon: Workflow },
  { value: 'portal-access', label: 'Portal access', icon: UserRound },
  { value: 'webhooks',      label: 'Webhooks',      icon: Webhook },
  { value: 'audit',         label: 'Audit log',     icon: History },
];

const SETUP_STEPS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'branding',    label: 'Branding',    icon: Palette },
  { value: 'credentials', label: 'Credentials', icon: ShieldCheck },
  { value: 'templates',   label: 'Templates',   icon: LayoutTemplate },
  { value: 'test-send',   label: 'Test send',   icon: Send },
  { value: 'api-keys',    label: 'API keys',    icon: KeyRound },
];

export function TenantWorkspaceTabs({
  analytics, ai, automation, portalAccess, webhooks, audit,
  branding, credentials, templates, testSend, apiKeys,
}: {
  analytics: React.ReactNode; ai: React.ReactNode; automation: React.ReactNode; portalAccess: React.ReactNode;
  webhooks: React.ReactNode; audit: React.ReactNode;
  branding: React.ReactNode; credentials: React.ReactNode; templates: React.ReactNode;
  testSend: React.ReactNode; apiKeys: React.ReactNode;
}) {
  const [section, setSection] = useState<'workspace' | 'setup'>('workspace');
  const [workspaceValue, setWorkspaceValue] = useState('analytics');
  const [setupValue, setSetupValue] = useState('branding');

  const workspacePanels: Record<string, React.ReactNode> = {
    analytics, ai, automation, 'portal-access': portalAccess, webhooks, audit,
  };
  const setupPanels: Record<string, React.ReactNode> = {
    branding, credentials, templates, 'test-send': testSend, 'api-keys': apiKeys,
  };

  return (
    <div>
      <div className="mb-5 inline-flex gap-1 rounded-xl bg-muted/60 p-1.5">
        {([
          { key: 'workspace' as const, label: 'Workspace', icon: LayoutGrid },
          { key: 'setup' as const,     label: 'Setup',     icon: ListChecks },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              section === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {/* Fully controlled (value/onValueChange), not defaultValue — Base UI's
          own "guess the initial tab" logic only registers correctly for a
          tree that's visible at mount, and silently never recovers once a
          hidden/conditionally-mounted tree becomes visible later. Owning
          the active value ourselves sidesteps that entirely. Both trees
          stay mounted (CSS visibility toggle, not mount/unmount) since even
          mount timing alone was unreliable. */}
      <div className={section === 'workspace' ? '' : 'hidden'}>
        <Tabs value={workspaceValue} onValueChange={(v) => v && setWorkspaceValue(String(v))}>
          <TabsList variant="pills">
            {WORKSPACE_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {WORKSPACE_TABS.map(({ value }) => (
            <TabsContent key={value} value={value} className="mt-5">
              {workspacePanels[value]}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className={section === 'setup' ? '' : 'hidden'}>
        <Tabs value={setupValue} onValueChange={(v) => v && setSetupValue(String(v))}>
          <p className="mb-3 text-xs text-muted-foreground">One-time steps to get this tenant sending — revisit anytime.</p>
          <TabsList variant="pills" className="bg-transparent p-0">
            {SETUP_STEPS.map(({ value, label, icon: Icon }, i) => (
              <div key={value} className="flex items-center">
                {i > 0 && <div aria-hidden className="mx-1 h-px w-4 bg-border" />}
                <TabsTrigger
                  value={value}
                  className={cn(
                    'h-auto gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5',
                    'group-data-[variant=pills]/tabs-list:data-active:bg-primary/10 group-data-[variant=pills]/tabs-list:data-active:text-primary group-data-[variant=pills]/tabs-list:data-active:hover:bg-primary/10',
                    'data-active:border-primary/40 border-border/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                      'bg-muted text-muted-foreground in-data-active:bg-primary in-data-active:text-primary-foreground'
                    )}
                  >
                    {i + 1}
                  </span>
                  <Icon className="size-3.5" /> {label}
                </TabsTrigger>
              </div>
            ))}
          </TabsList>
          {SETUP_STEPS.map(({ value }) => (
            <TabsContent key={value} value={value} className="mt-5">
              {setupPanels[value]}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
