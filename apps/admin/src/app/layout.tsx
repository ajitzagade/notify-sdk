export const metadata = { title: '@orgname/notify — Admin' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', background: '#f7f7f8' }}>
        {children}
      </body>
    </html>
  );
}
