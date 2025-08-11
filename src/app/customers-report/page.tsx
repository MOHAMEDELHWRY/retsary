"use client";

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTransactions } from '@/context/transactions-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Download, Calendar as CalendarIcon, Search, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type CustomerSummary = {
  customerName: string;
  totalPurchase: number; // رأس مال العميل (التكلفة الإجمالية)
  totalSales: number; // إجمالي البيع
  receivedFromCustomer: number; // مدفوعات العميل للمورد
  receivedFromSupplier: number; // رصيد نقدي تلقاه العميل من المورد (حسب الحقل receivedBy)
  remainingQtyAtFactory: number; // البضاعة بالمصنع (كمية)
  remainingValueAtFactory: number; // قيمة البضاعة بالمصنع
  netBalance: number; // (المستلم من العميل − إجمالي البيع) − المستلم من المورد
};

export default function CustomersReportPage() {
  const { transactions, loading } = useTransactions();

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [includeEmptyCustomers, setIncludeEmptyCustomers] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      // Date filter
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      // Customer presence filter
      const cname = (t.customerName || '').trim();
      if (!includeEmptyCustomers && !cname) return false;
      // Search filter against customer and supplier
      if (search) {
        const s = search.toLowerCase();
        const hit = cname.toLowerCase().includes(s) || t.supplierName.toLowerCase().includes(s) || (t.operationKey || '').toLowerCase().includes(s);
        if (!hit) return false;
      }
      return true;
    });
  }, [transactions, startDate, endDate, includeEmptyCustomers, search]);

  const summaries = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();
    for (const t of filtered) {
      const key = (t.customerName || '-').trim() || '-';
      const current = map.get(key) || {
        customerName: key,
        totalPurchase: 0,
        totalSales: 0,
        receivedFromCustomer: 0,
        receivedFromSupplier: 0,
        remainingQtyAtFactory: 0,
        remainingValueAtFactory: 0,
        netBalance: 0,
      };
      current.totalPurchase += Number(t.totalPurchasePrice) || 0;
      current.totalSales += Number(t.totalSellingPrice) || 0;
      current.receivedFromCustomer += Number(t.amountReceivedFromCustomer) || 0;
      // "دفعة من المورد" تُسجل على مستوى العملية مع حقل receivedBy (العميل)
      // نضيف فقط المبالغ التي وُجهت لهذا العميل
      if ((t.receivedBy || '').trim() === key) {
        current.receivedFromSupplier += Number(t.amountReceivedFromSupplier) || 0;
      }
      current.remainingQtyAtFactory += Number(t.remainingQuantity) || 0;
      current.remainingValueAtFactory += Number(t.remainingAmount) || 0;
      map.set(key, current);
    }
    // Compute net balance for each summary
    for (const [k, s] of map) {
      s.netBalance = (s.receivedFromCustomer - s.totalSales) - s.receivedFromSupplier;
      map.set(k, s);
    }
    // Sort by absolute net balance desc
    return Array.from(map.values()).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
  }, [filtered]);

  const totals = useMemo(() => {
    const acc = {
      totalPurchase: 0,
      totalSales: 0,
      receivedFromCustomer: 0,
      receivedFromSupplier: 0,
      remainingQtyAtFactory: 0,
      remainingValueAtFactory: 0,
      netBalance: 0,
    };
    for (const s of summaries) {
      acc.totalPurchase += Number(s.totalPurchase) || 0;
      acc.totalSales += Number(s.totalSales) || 0;
      acc.receivedFromCustomer += Number(s.receivedFromCustomer) || 0;
      acc.receivedFromSupplier += Number(s.receivedFromSupplier) || 0;
      acc.remainingQtyAtFactory += Number(s.remainingQtyAtFactory) || 0;
      acc.remainingValueAtFactory += Number(s.remainingValueAtFactory) || 0;
      acc.netBalance += Number(s.netBalance) || 0;
    }
    return acc;
  }, [summaries]);

  const handleExportCSV = () => {
    const headers = [
      'اسم العميل',
      'رأس مال العميل',
      'إجمالي البيع',
      'مدفوعات العميل للمورد',
      'رصيد نقدي من المورد (مستلم)',
      'البضاعة بالمصنع (كمية)',
      'قيمة البضاعة بالمصنع',
      'صافي الرصيد',
      'الحالة',
    ];
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.match(/[",\n]/) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = summaries.map(s => {
      const status = s.netBalance > 0 ? 'دائن' : (s.netBalance < 0 ? 'مدين' : 'متزن');
      return [
        escape(s.customerName),
        s.totalPurchase.toFixed(2),
        s.totalSales.toFixed(2),
        s.receivedFromCustomer.toFixed(2),
        s.receivedFromSupplier.toFixed(2),
        s.remainingQtyAtFactory.toFixed(3),
        s.remainingValueAtFactory.toFixed(2),
        s.netBalance.toFixed(2),
        status,
      ].join(',');
    });
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const detailTransactions = useMemo(() => {
    if (!detailsCustomer) return [] as typeof transactions;
    const key = detailsCustomer.trim();
    return filtered.filter(t => ((t.customerName || '-').trim() || '-') === key);
  }, [detailsCustomer, filtered]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">تقرير العملاء</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}><Download className="ml-2 h-4 w-4" />تصدير CSV</Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>فلترة</CardTitle>
          <div className="flex flex-col md:flex-row gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ابحث باسم العميل، المورد أو المفتاح..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full md:w-[200px] justify-start text-right font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: ar }) : <span>من تاريخ</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full md:w-[200px] justify-start text-right font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: ar }) : <span>إلى تاريخ</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>مسح التاريخ</Button>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeEmptyCustomers} onChange={(e) => setIncludeEmptyCustomers(e.target.checked)} />
                تضمين العمليات بدون اسم عميل
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>رأس مال العميل</TableHead>
                <TableHead>إجمالي البيع</TableHead>
                <TableHead>مدفوعات العميل للمورد</TableHead>
                <TableHead>رصيد نقدي من المورد</TableHead>
                <TableHead>البضاعة بالمصنع</TableHead>
                <TableHead>قيمة البضاعة بالمصنع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد بيانات للعرض.</TableCell>
                </TableRow>
              ) : summaries.map((s) => {
                const status = s.netBalance > 0 ? 'دائن' : (s.netBalance < 0 ? 'مدين' : 'متزن');
                return (
                  <TableRow key={s.customerName}>
                    <TableCell className="font-medium">{s.customerName}</TableCell>
                    <TableCell>{s.totalPurchase.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                    <TableCell>{s.totalSales.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                    <TableCell>{s.receivedFromCustomer.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                    <TableCell>{s.receivedFromSupplier.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                    <TableCell>{s.remainingQtyAtFactory.toFixed(3)} طن</TableCell>
                    <TableCell>{s.remainingValueAtFactory.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                    <TableCell className={s.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {status} — {Math.abs(s.netBalance).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setDetailsCustomer(s.customerName)}>تفاصيل</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {summaries.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">إجمالي العملاء</TableCell>
                  <TableCell className="font-bold">{totals.totalPurchase.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                  <TableCell className="font-bold">{totals.totalSales.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                  <TableCell className="font-bold">{totals.receivedFromCustomer.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                  <TableCell className="font-bold">{totals.receivedFromSupplier.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                  <TableCell className="font-bold">{totals.remainingQtyAtFactory.toFixed(3)} طن</TableCell>
                  <TableCell className="font-bold">{totals.remainingValueAtFactory.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                  <TableCell className={totals.netBalance >= 0 ? 'font-bold text-green-700' : 'font-bold text-red-700'}>
                    {(totals.netBalance > 0 ? 'دائن' : (totals.netBalance < 0 ? 'مدين' : 'متزن'))} — {Math.abs(totals.netBalance).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detailsCustomer} onOpenChange={(open) => !open && setDetailsCustomer(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العميل</DialogTitle>
            <DialogDescription>عرض تفصيلي للعمليات والمدفوعات والرصيد</DialogDescription>
          </DialogHeader>
          {detailsCustomer && (
            <div className="space-y-4 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>اسم العميل</Label><div className="font-medium">{detailsCustomer}</div></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>الحالة تُحسب: (مدفوعات العميل − إجمالي البيع) − رصيد نقدي من المورد</span>
                </div>
              </div>

              <div className="p-3 border rounded">
                <h4 className="font-medium mb-2">العمليات المتعلقة بالعميل</h4>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>المورد</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>المخصوم</TableHead>
                        <TableHead>المتبقي</TableHead>
                        <TableHead>إجمالي البيع</TableHead>
                        <TableHead>مدفوع من العميل</TableHead>
                        <TableHead>مستلم من المورد</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{format(t.date, 'yyyy-MM-dd')}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={t.description}>{t.description}</TableCell>
                          <TableCell>{t.supplierName}</TableCell>
                          <TableCell>{t.quantity} طن</TableCell>
                          <TableCell>{(((t.actualQuantityDeducted || 0) + (t.otherQuantityDeducted || 0))).toFixed(2)} طن</TableCell>
                          <TableCell>{(t.remainingQuantity || 0).toFixed(2)} طن</TableCell>
                          <TableCell>{(t.totalSellingPrice || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                          <TableCell>{(t.amountReceivedFromCustomer || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                          <TableCell>{(t.receivedBy && t.receivedBy.trim() === (t.customerName || '').trim()) ? (t.amountReceivedFromSupplier || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">إغلاق</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
