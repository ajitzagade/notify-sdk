import './globals.css';
import { Toaster } from '@/components/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata = { title: '@orgname/notify — Admin' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </body>
    </html>
  );
}
