"use client";
import React, { useMemo, useState, useCallback } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatEGP } from '@/lib/utils';

// جدول ميزان العملاء: الفرق بين المستلم من العميل وإجمالي البيع لكل عميل
export default function CustomersBalancePage() {
  // سحب كل ما نحتاجه من السياق في استدعاء واحد
  const { transactions, loading, customerPayments, customerNames } = useTransactions();
  const [detailed, setDetailed] = useState(false);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');

  // أسماء العملاء المستبعدين من ميزان العملاء بشكل دائم
  const EXCLUDED_CUSTOMERS = useMemo(() => new Set<string>([
    'ناصر عراقى',
  ].map(s => s.trim())), []);
  const normalizeName = useCallback((s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim(), []);

  // تصفية المعاملات حسب الفلاتر
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
  if (customerFilter && normalizeName(t.customerName) !== normalizeName(customerFilter)) return false;
  // استبعاد العملاء المحظورين
  if (EXCLUDED_CUSTOMERS.has(normalizeName(t.customerName))) return false;
      const time = t.date?.getTime?.() || new Date(t.date).getTime();
      if (fromDate) {
        const from = new Date(fromDate).setHours(0,0,0,0);
        if (time < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate).setHours(23,59,59,999);
        if (time > to) return false;
      }
      return true;
    });
  }, [transactions, fromDate, toDate, customerFilter]);

  const filteredExternalPayments = useMemo(() => {
    return customerPayments.filter(p => {
  if (customerFilter && normalizeName(p.customerName) !== normalizeName(customerFilter)) return false;
  // استبعاد العملاء المحظورين
  if (EXCLUDED_CUSTOMERS.has(normalizeName(p.customerName))) return false;
      const time = p.date?.getTime?.() || new Date(p.date).getTime();
      if (fromDate) {
        const from = new Date(fromDate).setHours(0,0,0,0);
        if (time < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate).setHours(23,59,59,999);
        if (time > to) return false;
      }
      return true;
    });
  }, [customerPayments, fromDate, toDate, customerFilter]);

  const customerBalances = useMemo(() => {
    const map = new Map<string, { sales: number; received: number; supplier: number }>();
    for (const t of filteredTransactions) {
  const name = normalizeName(t.customerName);
      if (!name) continue;
  if (EXCLUDED_CUSTOMERS.has(name)) continue;
      const entry = map.get(name) || { sales: 0, received: 0, supplier: 0 };
      entry.sales += typeof t.totalSellingPrice === 'number' ? t.totalSellingPrice : 0;
      entry.received += typeof t.amountReceivedFromCustomer === 'number' ? t.amountReceivedFromCustomer : 0;
      map.set(name, entry);
      // لا نضيف الدفعات الداخلية هنا حتى لا نكرر المبلغ لو كان مدمجاً بالفعل في amountReceivedFromCustomer
    }
    // يمكن (اختيارياً) إدماج دفعات خارجية مستقلة في الإجمالي لتكون أكثر دقة مع الفلاتر.
    for (const p of filteredExternalPayments) {
  const name = normalizeName(p.customerName);
      if (!name) continue;
  if (EXCLUDED_CUSTOMERS.has(name)) continue;
      const entry = map.get(name) || { sales: 0, received: 0, supplier: 0 };
      entry.received += typeof p.amount === 'number' ? p.amount : 0; // قد يؤدي لتضخيم لو كانت نفس الدفعة احتسبت داخل transaction, لكن نعتبرها مستقلة.
      map.set(name, entry);
    }
    // أضف "المستلم من المورد" المنسوب حسب receivedBy ضمن نفس نطاق التاريخ والفلتر
    for (const t of transactions) {
      // تطبيق نطاق التاريخ فقط
      const time = t.date?.getTime?.() || new Date(t.date).getTime();
      if (fromDate) {
        const from = new Date(fromDate).setHours(0,0,0,0);
        if (time < from) continue;
      }
      if (toDate) {
        const to = new Date(toDate).setHours(23,59,59,999);
        if (time > to) continue;
      }
      const rb = Number((t as any).amountReceivedFromSupplier) || 0;
      const rbKey = normalizeName((t as any).receivedBy);
      if (rb <= 0 || !rbKey) continue;
      if (EXCLUDED_CUSTOMERS.has(rbKey)) continue;
      if (customerFilter && rbKey !== normalizeName(customerFilter)) continue;
      const entry = map.get(rbKey) || { sales: 0, received: 0, supplier: 0 };
      entry.supplier += rb;
      map.set(rbKey, entry);
    }
    const rows = Array.from(map.entries()).map(([customerName, v]) => {
      const receivedFromSupplier = v.supplier;
      const diff = v.received - v.sales - receivedFromSupplier; // الفرق = المستلم من العميل - اجمالي البيع - المستلم من المورد
      return { customerName, totalSales: v.sales, totalReceived: v.received, receivedFromSupplier, diff };
    }).sort((a,b) => a.customerName.localeCompare(b.customerName, 'ar')); // فرز أبجدي عربي
    return rows;
  }, [filteredTransactions, filteredExternalPayments, transactions, fromDate, toDate, customerFilter, EXCLUDED_CUSTOMERS, normalizeName]);

  // بناء كشف تفصيلي: كل عملية بيع و كل دفعة و كل "مستلم من المورد" للعميل مع رصيد جارٍ (المستلم من العميل - البيع - المستلم من المورد)
  const customerLedgers = useMemo(() => {
    // هيكل: customer -> entries[]
    const ledgerMap = new Map<string, Array<{
      id: string;
      date: Date;
      type: 'sale' | 'payment' | 'supplier';
      description: string;
      saleAmount: number; // مبلغ البيع (يخصم من الرصيد)
      paymentAmount: number; // مبلغ الدفعة (يزيد الرصيد)
      supplierAmount: number; // المستلم من المورد (يخصم من الرصيد)
      runningBalance: number; // (المدفوع التراكمي - اجمالي البيع التراكمي - المستلم من المورد تراكميًا)
      meta?: string; // تفاصيل إضافية
    }>>();

    // مؤشرات تجميع تراكمي
    const cumulative = new Map<string, { sales: number; payments: number; supplier: number }>();

    // تجهيز جميع الأحداث (مبيعات + دفعات) لكل عميل
    type Event = { customerName: string; date: Date; type: 'sale' | 'payment' | 'supplier'; amount: number; id: string; description: string };
    const events: Event[] = [];

    for (const t of filteredTransactions) {
  const name = normalizeName(t.customerName);
      if (!name) continue;
  if (EXCLUDED_CUSTOMERS.has(name)) continue;
      const saleAmount = typeof t.totalSellingPrice === 'number' ? t.totalSellingPrice : 0;
      events.push({
        customerName: name,
        date: t.date || new Date(),
        type: 'sale',
        amount: saleAmount,
        id: `sale-${t.id}`,
        description: `مبيعة رقم ${t.operationNumber || t.transactionNumber || t.id}`
      });
      // دفعات داخلية (customerPayments ضمن العملية)
      if (Array.isArray(t.customerPayments)) {
        t.customerPayments.forEach((cp, idx) => {
          const pAmt = typeof cp.amount === 'number' ? cp.amount : 0;
          if (!pAmt) return;
          const pDate = cp.date || t.date || new Date();
            // تحقق من الفلتر الزمني
          const time = pDate.getTime();
          if (fromDate) {
            const from = new Date(fromDate).setHours(0,0,0,0);
            if (time < from) return;
          }
          if (toDate) {
            const to = new Date(toDate).setHours(23,59,59,999);
            if (time > to) return;
          }
          events.push({
            customerName: name,
            date: pDate,
            type: 'payment',
            amount: pAmt,
            id: `intpay-${t.id}-${idx}`,
            description: `دفعة داخلية${cp.applied ? ' (معتمدة)' : ''} من العملية ${t.operationNumber || t.transactionNumber || t.id}`
          });
        });
      }
    }

    for (const p of filteredExternalPayments) {
  const name = normalizeName(p.customerName);
      if (!name) continue;
  if (EXCLUDED_CUSTOMERS.has(name)) continue;
      const payAmount = typeof p.amount === 'number' ? p.amount : 0;
      events.push({
        customerName: name,
        date: p.date || new Date(),
        type: 'payment',
        amount: payAmount,
        id: `payment-${p.id}`,
        description: p.notes || (p.transactionType === 'sale' ? 'مدخل آلي' : 'دفعة عميل')
      });
    }

    // إدراج أحداث المستلم من المورد من كل المعاملات ضمن نطاق التاريخ والفلتر
    for (const t of transactions) {
      const time = t.date?.getTime?.() || new Date(t.date).getTime();
      if (fromDate) {
        const from = new Date(fromDate).setHours(0,0,0,0);
        if (time < from) continue;
      }
      if (toDate) {
        const to = new Date(toDate).setHours(23,59,59,999);
        if (time > to) continue;
      }
      const amount = Number((t as any).amountReceivedFromSupplier) || 0;
      const rbKey = normalizeName((t as any).receivedBy);
      if (amount <= 0 || !rbKey) continue;
      if (EXCLUDED_CUSTOMERS.has(rbKey)) continue;
      if (customerFilter && rbKey !== normalizeName(customerFilter)) continue;
      events.push({
        customerName: rbKey,
        date: t.date || new Date(),
        type: 'supplier',
        amount,
        id: `supplier-${t.id}`,
        description: `مستلم من المورد`
      });
    }

    // فرز حسب التاريخ، عند تساوي التاريخ نجعل الدفعة بعد البيع أو العكس حسب احتياج التحليل.
    events.sort((a,b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
      // لضمان أن البيع يظهر أولاً في نفس اليوم قبل الدفعة
      if (a.type === b.type) return 0;
      return a.type === 'sale' ? -1 : 1;
    });

    for (const e of events) {
      const acc = cumulative.get(e.customerName) || { sales: 0, payments: 0, supplier: 0 };
      if (e.type === 'sale') acc.sales += e.amount;
      else if (e.type === 'payment') acc.payments += e.amount;
      else if (e.type === 'supplier') acc.supplier += e.amount;
      cumulative.set(e.customerName, acc);
      const runningBalance = acc.payments - acc.sales - acc.supplier; // مطابق للصيغة الجديدة
      const entry = {
        id: e.id,
        date: e.date,
        type: e.type,
  description: e.description,
        saleAmount: e.type === 'sale' ? e.amount : 0,
        paymentAmount: e.type === 'payment' ? e.amount : 0,
        supplierAmount: e.type === 'supplier' ? e.amount : 0,
        runningBalance,
      };
      const list = ledgerMap.get(e.customerName) || [];
      list.push(entry);
      ledgerMap.set(e.customerName, list);
    }

    return ledgerMap;
  }, [filteredTransactions, filteredExternalPayments, fromDate, toDate]);

  const totals = useMemo(() => {
    return customerBalances.reduce((acc, r) => {
      acc.sales += r.totalSales;
      acc.received += r.totalReceived;
      acc.supplier += (r.receivedFromSupplier || 0);
      acc.diff += r.diff;
      return acc;
    }, { sales: 0, received: 0, supplier: 0, diff: 0 });
  }, [customerBalances]);

  const handleExportSummary = () => {
    const headers = ['العميل','إجمالي البيع','المستلم من العميل','المستلم من المورد','الفرق (المستلم من العميل - إجمالي البيع - المستلم من المورد)','الحالة'];
    const lines = customerBalances.map(r => [
      r.customerName,
      r.totalSales,
      r.totalReceived,
      r.receivedFromSupplier || 0,
      r.diff,
      r.diff > 0 ? 'مدفوع زيادة' : (r.diff < 0 ? 'متبقي على العميل' : 'متوازن')
    ].join(','));
    const csv = '\uFEFF' + [headers.join(','), ...lines, ['الإجمالي', totals.sales, totals.received, totals.supplier, totals.diff, ''].join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customers-balance.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleExportDetailed = useCallback(() => {
    const headers = ['العميل','التاريخ','النوع','الوصف','مبلغ البيع','مبلغ الدفعة','الرصيد الجاري (المستلم - البيع)'];
    const lines: string[] = [];
    for (const customer of Array.from(customerLedgers.keys()).sort((a,b)=> a.localeCompare(b,'ar'))) {
      const entries = customerLedgers.get(customer)!;
      for (const e of entries) {
        lines.push([
          customer,
          e.date.toISOString().split('T')[0],
          e.type === 'sale' ? 'بيع' : 'دفعة',
          e.description.replace(/,/g,' '),
          e.saleAmount,
          e.paymentAmount,
          e.runningBalance
        ].join(','));
      }
    }
    const csv = '\uFEFF' + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customers-balance-detailed.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [customerLedgers]);

  if (loading) {
    return <div className="p-6"><Skeleton className="h-8 w-48" /><div className="mt-4 space-y-2">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle className="text-xl font-bold">ميزان العملاء {detailed && ' - تفصيلي'}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDetailed(d => !d)}>{detailed ? 'عرض مختصر' : 'عرض تفصيلي'}</Button>
            {detailed ? (
              <Button variant="outline" onClick={handleExportDetailed}>تصدير تفصيلي CSV</Button>
            ) : (
              <Button variant="outline" onClick={handleExportSummary}>تصدير CSV</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex flex-col text-xs w-full md:w-auto">
              <label className="mb-1">من تاريخ</label>
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
            </div>
            <div className="flex flex-col text-xs w-full md:w-auto">
              <label className="mb-1">إلى تاريخ</label>
              <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="border rounded px-2 py-1 text-xs" />
            </div>
            <div className="flex flex-col text-xs w-full md:w-56">
              <label className="mb-1">العميل</label>
              <select value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} className="border rounded px-2 py-1 text-xs">
                <option value="">الكل</option>
                {customerNames.filter(c=> !EXCLUDED_CUSTOMERS.has(normalizeName(c))).map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={()=>{setFromDate('');setToDate('');setCustomerFilter('');}} className="text-xs">تفريغ الفلاتر</Button>
            </div>
          </div>
          {!detailed && (
            <div className="overflow-auto max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>م</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>إجمالي البيع</TableHead>
                    <TableHead>المستلم من العميل</TableHead>
          <TableHead>المستلم من المورد</TableHead>
                    <TableHead>الفرق</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerBalances.map((r, idx) => {
                    const status = r.diff > 0 ? 'مدفوع زيادة' : (r.diff < 0 ? 'متبقي على العميل' : 'متوازن');
                    return (
                      <TableRow key={r.customerName}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{r.customerName}</TableCell>
                        <TableCell>{formatEGP(r.totalSales)}</TableCell>
                        <TableCell>{formatEGP(r.totalReceived)}</TableCell>
            <TableCell>{formatEGP(r.receivedFromSupplier || 0)}</TableCell>
                        <TableCell className={r.diff>0?'text-green-600':r.diff<0?'text-red-600':''}>
                          {r.diff===0?'0':formatEGP(r.diff)}
                        </TableCell>
                        <TableCell>{status}</TableCell>
                      </TableRow>
                    );
                  })}
                  {customerBalances.length === 0 && (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                  )}
                </TableBody>
                <tfoot>
                  <TableRow className="font-semibold bg-muted/50">
          <TableCell colSpan={2}>الإجمالي</TableCell>
                    <TableCell>{formatEGP(totals.sales)}</TableCell>
                    <TableCell>{formatEGP(totals.received)}</TableCell>
          <TableCell>{formatEGP(totals.supplier)}</TableCell>
                    <TableCell className={totals.diff>0?'text-green-600':totals.diff<0?'text-red-600':''}>{formatEGP(totals.diff)}</TableCell>
                    <TableCell />
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          )}
          {detailed && (
            <div className="max-h-[70vh] overflow-auto pr-1">
              <Accordion type="multiple" className="space-y-2">
                {Array.from(customerLedgers.keys()).sort((a,b)=> a.localeCompare(b,'ar')).map((customerName, idx)=> {
                  const ledger = customerLedgers.get(customerName)!;
                  const last = ledger[ledger.length-1];
                  const balance = last?.runningBalance || 0;
                  return (
                    <AccordionItem key={customerName} value={customerName} className="border rounded-md px-2">
                      <AccordionTrigger className="flex items-center gap-4 py-2">
                        <div className="flex-1 text-right font-medium">{idx+1}. {customerName}</div>
                        <div className={balance>0?'text-green-600':balance<0?'text-red-600':''}>{formatEGP(balance)}</div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-auto">
                          <Table className="text-xs">
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>الوصف</TableHead>
                                <TableHead>بيع</TableHead>
                                <TableHead>دفعة</TableHead>
                                <TableHead>من المورد</TableHead>
                                <TableHead>الرصيد الجاري</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ledger.map((e,i)=> (
                                <TableRow key={e.id}>
                                  <TableCell>{i+1}</TableCell>
                                  <TableCell>{e.date.toLocaleDateString('ar-EG-u-nu-latn')}</TableCell>
                                  <TableCell>{e.type==='sale'?'بيع': (e.type==='payment'?'دفعة':'مورد')}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={e.description}>{e.description}</TableCell>
                                  <TableCell className={e.saleAmount? 'text-red-600':''}>{e.saleAmount? formatEGP(e.saleAmount): ''}</TableCell>
                                  <TableCell className={e.paymentAmount? 'text-green-600':''}>{e.paymentAmount? formatEGP(e.paymentAmount): ''}</TableCell>
                                  <TableCell className={e.supplierAmount? 'text-amber-700':''}>{e.supplierAmount? formatEGP(e.supplierAmount): ''}</TableCell>
                                  <TableCell className={e.runningBalance>0?'text-green-600':e.runningBalance<0?'text-red-600':''}>{formatEGP(e.runningBalance)}</TableCell>
                                </TableRow>
                              ))}
                                {/* إجمالي داخل الكشف */}
                                {ledger.length>0 && (() => {
                                  const totalsRow = ledger.reduce((acc,l)=>{acc.sales+=l.saleAmount;acc.payments+=l.paymentAmount;acc.supplier+= (l as any).supplierAmount||0;return acc;},{sales:0,payments:0,supplier:0});
                                  const finalBalance = ledger[ledger.length-1].runningBalance;
                                  return (
                                    <TableRow className="font-semibold bg-muted/40">
                                      <TableCell colSpan={4}>الإجمالي</TableCell>
                                      <TableCell className={totalsRow.sales? 'text-red-600':''}>{formatEGP(totalsRow.sales)}</TableCell>
                                      <TableCell className={totalsRow.payments? 'text-green-600':''}>{formatEGP(totalsRow.payments)}</TableCell>
                                      <TableCell className={totalsRow.supplier? 'text-amber-700':''}>{formatEGP(totalsRow.supplier)}</TableCell>
                                      <TableCell className={finalBalance>0?'text-green-600':finalBalance<0?'text-red-600':''}>{formatEGP(finalBalance)}</TableCell>
                                    </TableRow>
                                  );
                                })()}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
                {customerLedgers.size===0 && <div className="text-center text-muted-foreground py-4">لا توجد بيانات</div>}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
