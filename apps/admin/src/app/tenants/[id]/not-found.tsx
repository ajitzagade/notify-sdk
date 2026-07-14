import Link from 'next/link';
import { Building2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TenantNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Building2 className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">Tenant not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been removed, or the link is out of date.</p>
      </div>
      <Button size="sm" render={<Link href="/tenants" />}>
        <ArrowLeft /> Back to tenants
      </Button>
    </div>
  );
}
