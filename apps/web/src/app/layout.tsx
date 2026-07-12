import { NotifyProvider } from '@orgname/notify/react';

export const metadata = { title: '@orgname/notify — Demo' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NotifyProvider apiBase="/api/notify">
          {children}
        </NotifyProvider>
      </body>
    </html>
  );
}
