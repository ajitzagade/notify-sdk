import './globals.css';
import { Toaster } from '@/components/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata = { title: 'Message Broadcast by Azentis' };

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('notify-admin-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </body>
    </html>
  );
}
