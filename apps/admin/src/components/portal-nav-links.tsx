'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Megaphone, Users, LayoutTemplate, Inbox, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/portal',           label: 'Dashboard', icon: LayoutGrid, exact: true },
  { href: '/portal/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/portal/contacts',  label: 'Contacts',  icon: Users },
  { href: '/portal/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/portal/inbox',     label: 'Inbox',     icon: Inbox },
  { href: '/portal/analytics', label: 'Analytics', icon: BarChart3 },
];

export function PortalNavLinks({ openChatsCount = 0 }: { openChatsCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="mt-2 flex-1 space-y-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {label === 'Inbox' && openChatsCount > 0 && (
              <span
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-semibold tabular-nums',
                  active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary text-primary-foreground'
                )}
              >
                {openChatsCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
