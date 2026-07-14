'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TenantNavItem {
  id: string;
  name: string;
  logoBlobUrl: string | null;
  primaryColor: string | null;
  status: string;
}

export function SidebarTenantNav({ tenants }: { tenants: TenantNavItem[] }) {
  const pathname = usePathname();

  if (tenants.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">No tenants yet.</p>;
  }

  return (
    <div className="space-y-0.5">
      {tenants.map((t) => {
        const active = pathname === `/tenants/${t.id}` || pathname.startsWith(`/tenants/${t.id}/`);
        return (
          <Link
            key={t.id}
            href={`/tenants/${t.id}`}
            className={cn(
              'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
              active
                ? 'font-medium text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
            )}
          >
            {active && (
              <motion.span
                layoutId="tenant-nav-active"
                className="absolute inset-0 rounded-lg bg-sidebar-accent shadow-xs ring-1 ring-foreground/[0.04]"
                transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.6 }}
              />
            )}
            <Avatar className="relative z-10 size-5 rounded">
              {t.logoBlobUrl && <AvatarImage src={t.logoBlobUrl} alt="" />}
              <AvatarFallback color={t.primaryColor} className="rounded text-[9px]">
                {t.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="relative z-10 truncate">{t.name}</span>
            {t.status !== 'active' && (
              <span className="relative z-10 ml-auto size-1.5 shrink-0 rounded-full bg-muted-foreground" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
