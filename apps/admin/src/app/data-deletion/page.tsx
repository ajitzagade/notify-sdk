import Link from 'next/link';

export const metadata = {
  title: 'Data Deletion Instructions — AZentis Notify',
};

// Public page (no auth — see middleware PUBLIC_PATHS): Meta App Review accepts
// a "User data deletion" instructions URL in App settings → Basic; this is it.
export default function DataDeletionPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Data Deletion Instructions</h1>
      <p className="mt-1 text-sm text-muted-foreground">AZentis Notify</p>

      <div className="mt-8 grid gap-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-semibold tracking-tight">If you are a customer of a business using AZentis Notify</h2>
          <p className="mt-2 text-muted-foreground">
            Reply <b>STOP</b> to any WhatsApp message you received — you'll be opted out
            immediately and receive no further messages. To also have your message history and
            phone number deleted, email{' '}
            <a className="underline" href="mailto:azentisit@gmail.com">azentisit@gmail.com</a> with
            the subject <b>“Data deletion request”</b>, including the phone number the messages
            were sent to and, if known, the business that messaged you. We complete deletion
            within 30 days and confirm by reply.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold tracking-tight">If you are a business using AZentis Notify</h2>
          <p className="mt-2 text-muted-foreground">
            Email <a className="underline" href="mailto:azentisit@gmail.com">azentisit@gmail.com</a>{' '}
            from your registered account email with the subject <b>“Account deletion request”</b>.
            We delete your account, credentials, contacts, and message history within 30 days.
          </p>
        </section>

        <section>
          <p className="text-muted-foreground">
            See also our <Link className="underline" href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
