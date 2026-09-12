import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — AZentis Notify',
};

// Public page (no auth — see middleware PUBLIC_PATHS): Meta App Review
// requires a reachable Privacy Policy URL in App settings → Basic.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">AZentis Notify — effective 12 September 2026</p>

      <div className="prose-sm mt-8 grid gap-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight">
        <section>
          <h2>Who we are</h2>
          <p className="mt-2 text-muted-foreground">
            AZentis Notify is a business messaging platform that lets client businesses send
            WhatsApp notifications — appointment reminders, order updates, alerts, and similar
            messages — to their own customers, and manage the replies. It is operated by AZentis.
            Contact: <a className="underline" href="mailto:azentisit@gmail.com">azentisit@gmail.com</a>.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <p className="mt-2 text-muted-foreground">
            <b>From client businesses:</b> business name, category, branding, staff login emails,
            and WhatsApp Business Account credentials needed to send messages on the business's
            behalf (stored encrypted at rest).
          </p>
          <p className="mt-2 text-muted-foreground">
            <b>Processed for client businesses:</b> their customers' phone numbers, opt-in/opt-out
            consent state, message delivery logs, and message content the business sends or
            receives through WhatsApp. We process this data as a service provider to the business —
            the business is the data controller for its customers' information.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <p className="mt-2 text-muted-foreground">
            Solely to operate the service: delivering messages through Meta's WhatsApp Business
            Platform, showing businesses their own delivery analytics and conversations, enforcing
            customer opt-out (STOP/START) automatically, and securing accounts. We do not sell
            personal data, use customer message content for advertising, or share data across
            client businesses — every business's data is isolated.
          </p>
        </section>

        <section>
          <h2>Sharing</h2>
          <p className="mt-2 text-muted-foreground">
            Message data is shared with Meta Platforms, Inc. as required to deliver WhatsApp
            messages, subject to Meta's own terms. Infrastructure providers (hosting, database)
            process data on our behalf under standard safeguards. We disclose data only when
            required by law.
          </p>
        </section>

        <section>
          <h2>Retention &amp; security</h2>
          <p className="mt-2 text-muted-foreground">
            Credentials are encrypted with per-tenant keys. Message logs are retained while the
            business's account is active, so the business can access its own history. Data is
            deleted on account closure or on request (see below).
          </p>
        </section>

        <section>
          <h2>Data deletion</h2>
          <p className="mt-2 text-muted-foreground">
            Businesses and end customers can request deletion of their data at any time — see{' '}
            <Link className="underline" href="/data-deletion">Data Deletion Instructions</Link>.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p className="mt-2 text-muted-foreground">
            We'll update this page when the policy changes; the effective date above always
            reflects the current version.
          </p>
        </section>
      </div>
    </main>
  );
}
