import type { LucideIcon } from 'lucide-react';
import { CardTitle, CardDescription } from '@/components/ui/card';

/**
 * Standard settings-card header: tinted icon chip + title + description.
 * Drop inside <CardHeader> — CardAction still works as a sibling.
 */
export function CardTitleGroup({ icon: Icon, title, description, titleExtra }: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Rendered inline after the title — e.g. a status Badge. */
  titleExtra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          {titleExtra}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
    </div>
  );
}
