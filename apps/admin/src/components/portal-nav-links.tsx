'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Megaphone, Users, LayoutTemplate, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/portal/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/portal/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/portal/contacts',  label: 'Contacts',  icon: Users },
  { href: '/portal/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/portal/inbox',     label: 'Inbox',      icon: Inbox },
];

export function PortalNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mt-2 flex-1 space-y-0.5 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
