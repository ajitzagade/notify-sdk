'use client';

import { useState } from 'react';
import { LayoutGrid, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TenantWorkspaceTabs({
  analytics, ai, portalAccess, webhooks, audit,
  branding, credentials, templates, testSend, apiKeys,
}: {
  analytics: React.ReactNode; ai: React.ReactNode; portalAccess: React.ReactNode;
  webhooks: React.ReactNode; audit: React.ReactNode;
  branding: React.ReactNode; credentials: React.ReactNode; templates: React.ReactNode;
  testSend: React.ReactNode; apiKeys: React.ReactNode;
}) {
  const [section, setSection] = useState<'workspace' | 'setup'>('workspace');
  const [workspaceValue, setWorkspaceValue] = useState('analytics');
  const [setupValue, setSetupValue] = useState('branding');

  return (
    <div>
      <div className="mb-5 inline-flex gap-1 rounded-xl bg-muted/60 p-1.5">
        <button
          type="button"
          onClick={() => setSection('workspace')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            section === 'workspace'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
          )}
        >
          <LayoutGrid className="size-4" /> Workspace
        </button>
        <button
          type="button"
          onClick={() => setSection('setup')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            section === 'setup'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
          )}
        >
          <ListChecks className="size-4" /> Setup
        </button>
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
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="ai">AI assistant</TabsTrigger>
            <TabsTrigger value="portal-access">Portal access</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>
          <TabsContent value="analytics" className="mt-5">{analytics}</TabsContent>
          <TabsContent value="ai" className="mt-5">{ai}</TabsContent>
          <TabsContent value="portal-access" className="mt-5">{portalAccess}</TabsContent>
          <TabsContent value="webhooks" className="mt-5">{webhooks}</TabsContent>
          <TabsContent value="audit" className="mt-5">{audit}</TabsContent>
        </Tabs>
      </div>
      <div className={section === 'setup' ? '' : 'hidden'}>
        <Tabs value={setupValue} onValueChange={(v) => v && setSetupValue(String(v))}>
          <p className="mb-3 text-xs text-muted-foreground">One-time steps to get this tenant sending — revisit anytime.</p>
          <TabsList variant="steps">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="test-send">Test send</TabsTrigger>
            <TabsTrigger value="api-keys">API keys</TabsTrigger>
          </TabsList>
          <TabsContent value="branding" className="mt-5">{branding}</TabsContent>
          <TabsContent value="credentials" className="mt-5">{credentials}</TabsContent>
          <TabsContent value="templates" className="mt-5">{templates}</TabsContent>
          <TabsContent value="test-send" className="mt-5">{testSend}</TabsContent>
          <TabsContent value="api-keys" className="mt-5">{apiKeys}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
