import { FileText, Music } from 'lucide-react';

export type PreviewMediaKind = 'image' | 'video' | 'document' | 'audio';

/**
 * Simulates how a message will render on a recipient's WhatsApp — fixed to
 * WhatsApp's own colors regardless of the admin app's theme, since the point
 * is fidelity to that external UI, not consistency with this one.
 */
export function WhatsAppPreview({
  senderName,
  body,
  mediaUrl,
  mediaKind,
  caption,
  buttons,
}: {
  senderName?: string;
  body?: string;
  mediaUrl?: string | null;
  mediaKind?: PreviewMediaKind | null;
  caption?: string;
  /** Up to 3 quick-reply button labels, rendered below the bubble like a real WhatsApp interactive message. */
  buttons?: string[];
}) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasMedia = Boolean(mediaUrl && mediaKind);
  const text = hasMedia ? caption : body;

  return (
    <div className="overflow-hidden rounded-lg border border-black/10" style={{ background: '#e5ddd5' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#005e54' }}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
          {(senderName ?? 'B').slice(0, 1).toUpperCase()}
        </div>
        <span className="truncate text-sm font-medium text-white">{senderName || 'Your business'}</span>
      </div>

      <div className="p-4">
        <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-1.5 shadow-sm">
          {hasMedia && mediaKind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl!} alt="" className="max-h-56 w-full rounded-md object-cover" />
          )}
          {hasMedia && mediaKind === 'video' && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={mediaUrl!} controls className="max-h-56 w-full rounded-md bg-black" />
          )}
          {hasMedia && mediaKind === 'document' && (
            <div className="flex items-center gap-2 rounded-md bg-black/5 p-2.5 text-xs text-neutral-600">
              <FileText className="size-4 shrink-0" /> Document attached
            </div>
          )}
          {hasMedia && mediaKind === 'audio' && (
            <div className="flex items-center gap-2 rounded-md bg-black/5 p-2.5 text-xs text-neutral-600">
              <Music className="size-4 shrink-0" /> Voice note
            </div>
          )}

          <div className="px-1.5 pb-1 pt-1.5">
            {text ? (
              <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-neutral-900">{text}</p>
            ) : (
              <p className="text-[13px] italic text-neutral-400">Nothing to preview yet</p>
            )}
            <div className="mt-1 text-right text-[10px] text-neutral-400">{time}</div>
          </div>

          {buttons && buttons.length > 0 && (
            <div className="mt-0.5 border-t border-black/10">
              {buttons.map((label, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center px-1.5 py-2 text-[13px] font-medium"
                  style={{ color: '#00a5f4' }}
                >
                  {label || `Option ${i + 1}`}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
