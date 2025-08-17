"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, startTransition } from 'react';
import { BookUser, LineChart, Factory, Users, SidebarClose, LogOut, Wallet, ArrowRightLeft, Landmark, CreditCard, Receipt, Package, ListChecks, Activity, AlertTriangle, BarChart } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarFooter
} from '@/components/ui/sidebar';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { setOpenMobile } = useSidebar();
  
  // Prefetch all sidebar routes to make navigation feel instant
  useEffect(() => {
    const anyRouter = router as unknown as { prefetch?: (href: string) => void };
    const hrefs = [
      '/',
      '/transactions-log',
      '/suppliers-report',
      '/suppliers-log',
      '/customers-log',
      '/customers-report',
      '/customers-balance',
      '/inventory-report',
      '/inventory-movement',
      '/inventory-alerts',
      '/inventory-valuation',
      '/factory-report',
      '/reports',
      '/expenses-report',
    ];
    hrefs.forEach((href) => anyRouter.prefetch?.(href));
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
      toast({
        title: 'تم تسجيل الخروج',
        description: 'تم تسجيل خروجك بنجاح.',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تسجيل الخروج.',
        variant: 'destructive',
      });
    }
  };

  const menuItems = [
    { href: '/', label: 'لوحة التحكم', icon: BookUser, isActive: () => pathname === '/' },
    { href: '/transactions-log', label: 'سجل العمليات', icon: ListChecks, isActive: () => pathname === '/transactions-log' },
    { href: '/suppliers-report', label: 'تقرير الموردين', icon: Users, isActive: () => pathname === '/suppliers-report' },
    { href: '/suppliers-log', label: 'سجل الموردين', icon: Users, isActive: () => pathname === '/suppliers-log' },
  { href: '/customers-log', label: 'سجل العملاء', icon: Users, isActive: () => pathname === '/customers-log' },
  { href: '/customers-report', label: 'تقرير العملاء', icon: Users, isActive: () => pathname === '/customers-report' },
  { href: '/customers-balance', label: 'ميزان العملاء', icon: Receipt, isActive: () => pathname === '/customers-balance' },
  
    { href: '/inventory-report', label: 'تقرير المخزون التراكمي', icon: Package, isActive: () => pathname === '/inventory-report' },
    { href: '/inventory-movement', label: 'سجل حركات المخزون', icon: Activity, isActive: () => pathname === '/inventory-movement' },
    { href: '/inventory-alerts', label: 'تنبيهات المخزون', icon: AlertTriangle, isActive: () => pathname === '/inventory-alerts' },
    { href: '/inventory-valuation', label: 'تقييم المخزون', icon: BarChart, isActive: () => pathname === '/inventory-valuation' },
    { href: '/factory-report', label: 'تقرير المصنع', icon: Factory, isActive: () => pathname === '/factory-report' },
    { href: '/reports', label: 'تقارير المبيعات', icon: LineChart, isActive: () => pathname === '/reports' },
    { href: '/expenses-report', label: 'تقرير المصروفات', icon: Wallet, isActive: () => pathname === '/expenses-report' },
  // { href: '/transfers-report', label: 'تقرير التحويلات', icon: ArrowRightLeft, isActive: () => pathname === '/transfers-report' }, // deprecated
  ];

  return (
    <Sidebar side="right">
      <SidebarHeader className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-sidebar-foreground p-2 group-data-[collapsible=icon]:hidden">
          دفتر الموردين
        </h2>
         <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpenMobile(false)}>
            <SidebarClose />
            <span className="sr-only">Close sidebar</span>
          </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={item.isActive()} tooltip={{ children: item.label }}>
                <Link
                  href={item.href}
                  prefetch
                  onMouseEnter={() => {
                    const anyRouter = router as unknown as { prefetch?: (href: string) => void };
                    anyRouter.prefetch?.(item.href);
                  }}
                  onClick={(e) => {
                    // استخدم التوجيه البرمجي لضمان الانتقال حتى إن تم منع افتراضياً من المكون الأب
                    e.preventDefault();
                    startTransition(() => {
                      router.push(item.href);
                      setOpenMobile(false);
                    });
                  }}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip={{ children: 'تسجيل الخروج' }}>
              <LogOut />
              <span>تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
