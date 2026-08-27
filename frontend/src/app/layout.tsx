import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { Navbar } from '@/components/ui/Navbar';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Football Auction System – Real-Time Player Bidding Arena',
  description: 'Real-time multi-manager football auction drafts with server-authoritative live countdown and squad builder.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-arena-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-arena-950">
        <AuthProvider>
          <SocketProvider>
            <Navbar />
            <main className="flex-1 w-full flex flex-col">{children}</main>
            <Toaster
              position="bottom-right"
              theme="dark"
              toastOptions={{
                style: {
                  background: '#0d131f',
                  border: '1px solid #22314e',
                  color: '#f8fafc',
                },
              }}
            />
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
