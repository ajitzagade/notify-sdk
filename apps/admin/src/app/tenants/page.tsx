import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { listTenants } from '@/lib/tenants';
import { NewTenantForm } from './NewTenantForm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active:    'default',
  suspended: 'secondary',
  archived:  'outline',
};

export default async function TenantsPage() {
  requireAdminSessionOrRedirect();
  const tenants = await listTenants();

  const active = tenants.filter((t) => t.status === 'active').length;
  const suspended = tenants.filter((t) => t.status === 'suspended').length;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Every business running on this platform, in one place.</p>
        </div>
        <NewTenantForm />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <div className="mb-8 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Total tenants</div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums">{tenants.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Active</div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-primary">{active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Suspended</div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums">{suspended}</div>
            </CardContent>
          </Card>
        </div>

        {tenants.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                <Building2 className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No tenants yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create one to onboard the first business onto this platform.</p>
              </div>
              <div className="mt-2"><NewTenantForm /></div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <ul>
              {tenants.map((t, i) => (
                <li key={t.id} className={i > 0 ? 'border-t border-border' : ''}>
                  <Link
                    href={`/tenants/${t.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <Avatar className="size-9 rounded-lg">
                      {t.logoBlobUrl && <AvatarImage src={t.logoBlobUrl} alt="" />}
                      <AvatarFallback color={t.primaryColor} className="rounded-lg text-xs">
                        {t.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{t.slug}</div>
                    </div>
                    <Badge variant={STATUS_VARIANT[t.status] ?? 'outline'}>{t.status}</Badge>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
