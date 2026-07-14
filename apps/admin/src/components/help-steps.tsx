import { CircleHelp, ExternalLink } from 'lucide-react';

export interface HelpStep {
  text: React.ReactNode;
  /** Optional deep link opened in a new tab, rendered after the step text. */
  href?: string;
  hrefLabel?: string;
}

/**
 * Onboarding help aside: numbered walk-through of where to find the keys a
 * form asks for. Render next to the form (see CredentialsForm) — it uses the
 * horizontal space settings cards otherwise leave empty.
 */
export function HelpSteps({ title, intro, steps }: {
  title: string;
  intro?: React.ReactNode;
  steps: HelpStep[];
}) {
  return (
    <aside className="h-fit rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CircleHelp className="size-4 text-primary" /> {title}
      </div>
      {intro && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{intro}</p>}
      <ol className="mt-3 grid gap-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 text-muted-foreground [&_b]:font-medium [&_b]:text-foreground [&_code]:text-foreground">
              {step.text}
              {step.href && (
                <>
                  {' '}
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {step.hrefLabel ?? 'Open'} <ExternalLink className="size-3" />
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
