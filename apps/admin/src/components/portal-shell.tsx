import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PortalNavLinks } from '@/components/portal-nav-links';
import { PortalSignOutButton } from '@/components/portal-sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';

export function PortalShell({
  children,
  tenantName,
  logoBlobUrl,
  primaryColor,
  email,
}: {
  children: React.ReactNode;
  tenantName: string;
  logoBlobUrl: string | null;
  primaryColor: string | null;
  email: string;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Avatar className="size-8 shrink-0 rounded-md">
            {logoBlobUrl && <AvatarImage src={logoBlobUrl} alt="" />}
            <AvatarFallback color={primaryColor} className="rounded-md text-xs">
              {tenantName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold tracking-tight">{tenantName}</div>
            <div className="text-[11px] text-muted-foreground">Tenant portal</div>
          </div>
        </div>

        <PortalNavLinks />

        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-3">
            <div className="min-w-0 truncate text-xs font-medium text-sidebar-foreground">{email}</div>
            <ThemeToggle className="shrink-0 text-muted-foreground hover:text-foreground" />
          </div>
          <PortalSignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-background">{children}</div>
    </div>
  );
}
