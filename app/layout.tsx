import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { TransactionsProvider } from '@/context/transactions-context';
import { AuthProvider } from '@/context/auth-context';
import { MainLayout } from '@/components/main-layout';
import { SidebarProvider } from '@/components/ui/sidebar';

export const metadata: Metadata = {
  title: 'دفتر حساباتي',
  description: 'إدارة حساباتك المالية بسهولة وكفاءة',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"></link>
      </head>
      <body className="font-body antialiased">
        <SidebarProvider>
          <AuthProvider>
            <TransactionsProvider>
              <MainLayout>
                {children}
              </MainLayout>
              <Toaster />
            </TransactionsProvider>
          </AuthProvider>
        </SidebarProvider>
      </body>
    </html>
  );
}
