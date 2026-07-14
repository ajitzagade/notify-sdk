'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PortalSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await fetch('/api/portal/auth/logout', { method: 'POST' });
    router.push('/portal/login');
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground"
      onClick={handleSignOut}
      disabled={loading}
    >
      <LogOut className="size-4" />
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
