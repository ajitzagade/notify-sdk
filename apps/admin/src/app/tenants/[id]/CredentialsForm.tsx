'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, XCircle, Save, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/lib/toast';

export interface CredentialsStatus {
  configured: boolean;
  phoneNumberId?: string;
  wabaId?: string | null;
  lastVerifiedAt?: string | null;
  lastVerifiedStatus?: string | null;
}

export function CredentialsForm({ tenantId, status }: { tenantId: string; status: CredentialsStatus }) {
  const router = useRouter();
  const [accessToken, setAccessToken]     = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState(status.phoneNumberId ?? '');
  const [wabaId, setWabaId]               = useState(status.wabaId ?? '');
  const [appSecret, setAppSecret]         = useState('');

  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [verifying, setVerifying]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/credentials/verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accessToken, phoneNumberId }),
      });
      const data = await res.json();
      if (data.ok) {
        const message = `Verified — ${data.displayName ?? 'unnamed'} (${data.displayPhoneNumber ?? phoneNumberId})`;
        setVerifyResult({ ok: true, message });
        toast.success(message, 'Credentials verified');
      } else {
        const message = data.error ?? 'Verification failed';
        setVerifyResult({ ok: false, message });
        toast.error(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVerifyResult({ ok: false, message });
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/credentials`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accessToken, phoneNumberId, wabaId: wabaId || undefined, appSecret: appSecret || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save credentials');
      toast.success('Credentials saved');
      setAccessToken('');
      setAppSecret('');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitleGroup
          icon={ShieldCheck}
          title="WhatsApp credentials"
          titleExtra={
            <Badge variant={status.configured ? 'default' : 'outline'}>
              {status.configured ? 'Configured' : 'Not configured'}
            </Badge>
          }
          description={status.configured
            ? `Last verified ${status.lastVerifiedAt ? new Date(status.lastVerifiedAt).toLocaleString() : 'never'} (${status.lastVerifiedStatus ?? 'unknown'})`
            : 'Enter and verify this tenant’s Meta credentials before sending anything.'}
        />
      </CardHeader>
      <CardContent>
        <form id="credentials-form" onSubmit={handleSave} className="grid max-w-2xl gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="phone-number-id">Phone Number ID</Label>
              <Input id="phone-number-id" required value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="waba-id">Business Account ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="waba-id" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="access-token">
              Access Token {status.configured && <span className="font-normal text-muted-foreground">(leave blank to keep current)</span>}
            </Label>
            <Input
              id="access-token"
              required={!status.configured}
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-secret">App Secret (optional, enables webhook signature verification)</Label>
            <Input id="app-secret" type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
          </div>

          {verifyResult && (
            <Alert variant={verifyResult.ok ? 'default' : 'destructive'}>
              {verifyResult.ok ? <CheckCircle2 /> : <XCircle />}
              <AlertDescription>{verifyResult.message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleVerify}
          disabled={verifying || !accessToken || !phoneNumberId}
        >
          {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          {verifying ? 'Verifying…' : 'Verify against Meta'}
        </Button>
        <Button type="submit" form="credentials-form" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? 'Saving…' : 'Save credentials'}
        </Button>
      </CardFooter>
    </Card>
  );
}
