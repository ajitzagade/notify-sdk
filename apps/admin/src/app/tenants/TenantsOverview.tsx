'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { Building2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active:    'default',
  suspended: 'secondary',
  archived:  'outline',
};

interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  logoBlobUrl: string | null;
  primaryColor: string | null;
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

export function TenantsOverview({ tenants }: { tenants: TenantListItem[] }) {
  return (
    <>
      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Building2 className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No tenants yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one to onboard the first business onto this platform.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <motion.ul variants={listVariants} initial="hidden" animate="show">
            {tenants.map((t, i) => (
              <motion.li key={t.id} variants={itemVariants} className={i > 0 ? 'border-t border-border' : ''}>
                <Link
                  href={`/tenants/${t.id}`}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <Avatar className="size-9 rounded-lg transition-transform duration-200 group-hover:scale-105">
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
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        </Card>
      )}
    </>
  );
}
