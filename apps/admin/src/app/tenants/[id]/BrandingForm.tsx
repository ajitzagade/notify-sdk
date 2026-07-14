'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Save, Loader2 } from 'lucide-react';
import type { TenantRecord } from '@/lib/tenants';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/lib/toast';

export function BrandingForm({ tenant }: { tenant: TenantRecord }) {
  const router = useRouter();
  // shadcn's Input wrapper doesn't forward refs (React 18) — remount via key instead of ref.value = ''.
  const [fileInputKey, setFileInputKey] = useState(0);

  const [name, setName]                 = useState(tenant.name);
  const [primaryColor, setPrimaryColor] = useState(tenant.primaryColor ?? '#111111');
  const [description, setDescription]   = useState(tenant.businessDescription ?? '');
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, primaryColor, businessDescription: description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      toast.success('Branding saved');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/tenants/${tenant.id}/logo`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      toast.success('Logo updated');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      setFileInputKey((k) => k + 1);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>How this tenant appears across the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="branding-form" onSubmit={handleSave} className="grid gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 rounded-lg">
              {tenant.logoBlobUrl && <AvatarImage src={tenant.logoBlobUrl} alt="" />}
              <AvatarFallback color={primaryColor} className="rounded-lg text-base" />
            </Avatar>
            <div className="grid gap-2">
              <Input
                key={fileInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoChange}
                disabled={uploading}
                className="max-w-64"
              />
              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branding-name">Business name</Label>
            <Input id="branding-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branding-color">Primary color</Label>
            <Input
              id="branding-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-16 p-1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branding-description">Business description</Label>
            <Textarea
              id="branding-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="branding-form" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? 'Saving…' : 'Save branding'}
        </Button>
      </CardFooter>
    </Card>
  );
}
