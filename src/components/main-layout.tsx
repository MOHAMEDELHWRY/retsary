"use client";

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from './ui/skeleton';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading } = useAuth();

  const isPublicPage = pathname.startsWith('/share/') || pathname.startsWith('/sales-balance-report/') || pathname === '/login';

  useEffect(() => {
    if (!loading && !currentUser && !isPublicPage) {
      router.push('/login');
    }
  }, [loading, currentUser, isPublicPage, pathname, router]);

  // Render public pages immediately
  if (isPublicPage) {
    return <>{children}</>;
  }

  // For protected pages, show a loading skeleton while auth state is being determined
  // or before redirecting. This prevents rendering children that need the providers.
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  // If we reach here, it's a protected page and the user is authenticated.
  // Render the full layout with all necessary providers.
  // For development, always show the sidebar layout
  return (
    <>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
    </>
  );
}
