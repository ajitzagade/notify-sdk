import type { FlowStep } from '@/lib/flowDefinitions';

/**
 * Simulates the whole back-and-forth on a recipient's WhatsApp — trigger,
 * each question (with its quick-reply buttons, if any), a stand-in customer
 * reply so the turn-taking reads naturally, then the completion message.
 * Fixed to WhatsApp's own colors regardless of the admin app's theme, same
 * rationale as components/whatsapp-preview.tsx.
 */
export function AutomationFlowPreview({
  triggerKeyword, steps, completionMessage,
}: { triggerKeyword: string; steps: FlowStep[]; completionMessage: string }) {
  const trigger = triggerKeyword.trim() || 'book';

  return (
    <div className="overflow-hidden rounded-lg border border-black/10" style={{ background: '#e5ddd5' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#005e54' }}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">B</div>
        <span className="truncate text-sm font-medium text-white">Your business</span>
      </div>

      <div className="grid max-h-[440px] gap-2 overflow-y-auto p-3">
        <Bubble from="customer">{trigger}</Bubble>

        {steps.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] italic text-neutral-500">Add a question to see it here</p>
        ) : (
          steps.map((step, i) => (
            <div key={i} className="grid gap-2">
              <Bubble from="bot" buttons={step.options}>{step.question || `Question ${i + 1}`}</Bubble>
              <Bubble from="customer">{step.options?.[0] ?? 'Sure!'}</Bubble>
            </div>
          ))
        )}

        {completionMessage.trim() && <Bubble from="bot">{completionMessage}</Bubble>}
      </div>
    </div>
  );
}

function Bubble({ from, buttons, children }: { from: 'bot' | 'customer'; buttons?: string[]; children: string }) {
  const isBot = from === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-lg p-1.5 shadow-sm ${isBot ? 'rounded-tl-none bg-white' : 'rounded-tr-none'}`}
        style={!isBot ? { background: '#dcf8c6' } : undefined}
      >
        <div className="px-1.5 pb-1 pt-1.5">
          <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-neutral-900">{children}</p>
        </div>
        {isBot && buttons && buttons.length > 0 && (
          <div className="mt-0.5 border-t border-black/10">
            {buttons.map((label, i) => (
              <div key={i} className="flex items-center justify-center px-1.5 py-2 text-[13px] font-medium" style={{ color: '#00a5f4' }}>
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
