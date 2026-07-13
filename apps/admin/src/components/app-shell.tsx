import Link from 'next/link';
import { LayoutGrid, Plus } from 'lucide-react';
import { listTenants } from '@/lib/tenants';
import { SidebarTenantNav } from './sidebar-tenant-nav';
import { SignOutButton } from './sign-out-button';

export async function AppShell({
  children,
  email,
  role,
}: {
  children: React.ReactNode;
  email?: string;
  role?: string;
}) {
  const tenants = await listTenants();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.4-3.6A7.96 7.96 0 0 1 4 12Z" />
              <circle cx="9" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="12.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="16" cy="12" r="0.8" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">notify-sdk</div>
            <div className="text-[11px] text-muted-foreground">Admin console</div>
          </div>
        </div>

        <div className="px-3">
          <Link
            href="/tenants"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LayoutGrid className="size-4" /> All tenants
          </Link>
        </div>

        <div className="mt-5 flex items-center justify-between px-6">
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Tenants · {tenants.length}
          </span>
          <Link href="/tenants" title="Add a tenant" className="text-muted-foreground transition-colors hover:text-foreground">
            <Plus className="size-3.5" />
          </Link>
        </div>
        <nav className="mt-2 flex-1 overflow-y-auto px-3 pb-3">
          <SidebarTenantNav
            tenants={tenants.map((t) => ({
              id: t.id,
              name: t.name,
              logoBlobUrl: t.logoBlobUrl,
              primaryColor: t.primaryColor,
              status: t.status,
            }))}
          />
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          {email && (
            <div className="mb-1.5 px-3">
              <div className="truncate text-xs font-medium text-sidebar-foreground">{email}</div>
              <div className="text-[11px] capitalize text-muted-foreground">{role}</div>
            </div>
          )}
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-background">{children}</div>
    </div>
  );
}
