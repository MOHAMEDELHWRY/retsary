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
import { Download, Calendar as CalendarIcon, Search, Info, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

type CustomerSummary = {
  customerName: string;
  totalPurchase: number; // رأس مال العميل (التكلفة الإجمالية)
  totalSales: number; // إجمالي البيع
  receivedFromCustomer: number; // مدفوعات العميل للمورد
  receivedFromSupplier: number; // المستلم من المورد لصالح العميل (حسب الحقل receivedBy)
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
        const hit = cname.toLowerCase().includes(s)
          || t.supplierName.toLowerCase().includes(s)
          || (t.operationKey || '').toLowerCase().includes(s)
          || ((t.receivedBy || '').toLowerCase().includes(s));
        if (!hit) return false;
      }
      return true;
    });
  }, [transactions, startDate, endDate, includeEmptyCustomers, search]);

  const summaries = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();
    // لتجنب فقدان دفعات المورد التي قد لا تحتوي على اسم عميل، سنمر على "filtered" للأساسيات
    // ثم ننسب دفعات المورد حسب receivedBy بشكل صريح.
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
      // دفعات المورد ستُنسب لاحقاً بشكل صريح حسب receivedBy
      current.remainingQtyAtFactory += Number(t.remainingQuantity) || 0;
      current.remainingValueAtFactory += Number(t.remainingAmount) || 0;
      map.set(key, current);
    }
    // مرَّ على جميع العمليات ضمن نفس نطاق التاريخ/البحث لإضافة "المستلم من المورد" حسب receivedBy حتى لو لم يوجد customerName
    for (const t of transactions) {
      if (startDate && t.date < startDate) continue;
      if (endDate && t.date > endDate) continue;
      if (search) {
        const s = search.toLowerCase();
        const hit = (t.customerName || '').toLowerCase().includes(s)
          || t.supplierName.toLowerCase().includes(s)
          || (t.operationKey || '').toLowerCase().includes(s)
          || ((t.receivedBy || '').toLowerCase().includes(s));
        if (!hit) continue;
      }
      const rb = (Number(t.amountReceivedFromSupplier) || 0);
      const rbKey = (t.receivedBy || '').trim();
      if (rb > 0 && rbKey) {
        const current = map.get(rbKey) || {
          customerName: rbKey,
          totalPurchase: 0,
          totalSales: 0,
          receivedFromCustomer: 0,
          receivedFromSupplier: 0,
          remainingQtyAtFactory: 0,
          remainingValueAtFactory: 0,
          netBalance: 0,
        };
        current.receivedFromSupplier += rb;
        map.set(rbKey, current);
      }
    }
    // Compute net balance for each summary
    for (const [k, s] of map) {
      s.netBalance = (s.receivedFromCustomer - s.totalSales) - s.receivedFromSupplier;
      map.set(k, s);
    }
    // Sort by absolute net balance desc
    return Array.from(map.values()).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
  }, [filtered, transactions, startDate, endDate, search]);

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
      'المستلم من المورد',
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
    const base = filtered.filter(t => ((t.customerName || '-').trim() || '-') === key);
    // سحب دفعات المورد الموجهة لهذا العميل حتى لو لم تكن العملية باسم هذا العميل
    // نطبق فقط مرشح التاريخ والبحث (يشمل receivedBy) دون تقييد includeEmptyCustomers حتى لا نفقد عمليات بدون اسم عميل
    const matchesDateAndSearch = (t: typeof transactions[number]) => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      if (search) {
        const s = search.toLowerCase();
        const hit = (t.customerName || '').toLowerCase().includes(s)
          || t.supplierName.toLowerCase().includes(s)
          || (t.operationKey || '').toLowerCase().includes(s)
          || ((t.receivedBy || '').toLowerCase().includes(s));
        if (!hit) return false;
      }
      return true;
    };
    const supplierCredits = transactions.filter(t =>
      matchesDateAndSearch(t)
      && (Number(t.amountReceivedFromSupplier) || 0) > 0
      && (t.receivedBy || '').trim() === key
      && ((t.customerName || '').trim() !== key)
    );
    return [...base, ...supplierCredits];
  }, [detailsCustomer, filtered]);

  // تحضير صفوف التفاصيل مع رصيد تراكمي (دائن - مدين)
  const detailedWithBalance = useMemo(() => {
    let running = 0; // يبدأ من صفر
    // تأكد من الترتيب حسب التاريخ لتسلسل صحيح
    const sorted = [...detailTransactions].sort((a,b) => a.date.getTime() - b.date.getTime());
    return sorted.map(t => {
      const saleDebit = t.totalSellingPrice || 0; // مدين من إجمالي البيع
      const supplierDebit = (detailsCustomer && t.receivedBy && t.receivedBy.trim() === detailsCustomer.trim()) ? (t.amountReceivedFromSupplier || 0) : 0; // المستلم من المورد يُحسب كمدين
      const debit = saleDebit + supplierDebit; // إجمالي المدين
      const creditFromCustomer = t.amountReceivedFromCustomer || 0; // دائن من العميل
      const credit = creditFromCustomer; // إجمالي الدائن
      running += (credit - debit); // الرصيد التراكمي (دائن - مدين)
      return { t, saleDebit, supplierDebit, debit, credit, creditFromCustomer, balance: running };
    });
  }, [detailTransactions]);

  const exportCustomerDetailsPDF = async () => {
    if (!detailsCustomer) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = `تفاصيل العميل: ${detailsCustomer}`;
    // خصائص وبيانات المستند + تلميحات اللغة إن كانت مدعومة
    doc.setProperties({
      title,
      subject: 'تقرير تفاصيل العميل',
      author: 'Retsary',
      creator: 'Retsary App'
    });
    // بعض إصدارات jsPDF تدعم setLanguage / setR2L — نستعملهما إن وُجدا
    (doc as any).setLanguage?.('ar-EG');
    (doc as any).setR2L?.(true);
    // تحميل وتفعيل خط عربي لضمان عرض النصوص العربية بشكل صحيح
    let arabicFontFamily = 'Amiri';
    const loadArabicFont = async () => {
      // نحاول أولاً خط Amiri (TTF موثوق)، ثم Noto Naskh Arabic (TTF)
      const tryFonts: { url: string; vfsName: string; family: string }[] = [
        { url: '/fonts/Amiri-Regular.ttf', vfsName: 'Amiri-Regular.ttf', family: 'Amiri' },
        { url: 'https://cdn.jsdelivr.net/gh/alif-type/amiri@0.121/font/ttf/Amiri-Regular.ttf', vfsName: 'Amiri-Regular.ttf', family: 'Amiri' },
        { url: '/fonts/NotoNaskhArabic-Regular.ttf', vfsName: 'NotoNaskhArabic-Regular.ttf', family: 'NotoNaskhArabic' },
        { url: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf', vfsName: 'NotoNaskhArabic-Regular.ttf', family: 'NotoNaskhArabic' },
      ];
      let lastError: any = null;
      const toBase64 = (buf: ArrayBuffer) => {
        // تحويل آمن إلى base64 بدون استهلاك ذاكرة ضخم
        let binary = '';
        const bytes = new Uint8Array(buf);
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes.subarray(i, i + chunkSize)) as any);
        }
        return btoa(binary);
      };
      for (const f of tryFonts) {
        try {
          const res = await fetch(f.url, { cache: 'force-cache' as RequestCache });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          const base64 = toBase64(buf);
          doc.addFileToVFS(f.vfsName, base64);
          doc.addFont(f.vfsName, f.family, 'normal');
          arabicFontFamily = f.family;
          doc.setFont(arabicFontFamily, 'normal');
          return true;
        } catch (err) {
          lastError = err;
        }
      }
      console.warn('Arabic font load failed:', lastError);
      doc.setFont('helvetica','normal');
      arabicFontFamily = 'helvetica';
      return false;
    };
    await loadArabicFont();
    // تهيئة التشكيل للنص العربي مع تحويل الأرقام إلى أرقام عربية دون تغيير ترتيبها
    let shape: (s: string) => string = (s) => s;
    const AR_NUMS = '٠١٢٣٤٥٦٧٨٩';
    const toArabicDigits = (str: string) => str.replace(/[0-9]/g, (d) => AR_NUMS[Number(d)]);
    try {
      const reshaper: any = await import('arabic-persian-reshaper');
      const reshapeFn: any = reshaper?.reshape || reshaper?.default;
      if (reshapeFn) {
        shape = (s: string) => {
          const input = toArabicDigits(String(s));
          // شكّل فقط إذا كان هناك أحرف عربية، واترك الأرقام وعلامات الترقيم كما هي
          return /[\u0600-\u06FF]/.test(input) ? reshapeFn(input) : input;
        };
      } else {
        shape = (s: string) => toArabicDigits(String(s));
      }
    } catch {
      shape = (s: string) => toArabicDigits(String(s));
    }
    // نجعل الحجم واضحاً لأننا لا نملك وزن Bold للخط المدمج
    doc.setFontSize(12);
  // ضع العنوان بمحاذاة يمين الصفحة
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(shape(title), pageWidth - 14, 12, { align: 'right' });
    doc.setFont('helvetica','normal');
  // أدوات تنسيق عربية للأرقام والعملات والتاريخ
  const fmtNumber = (n: number) => Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtCurrency = (n: number) => Number(n || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' });
  const fmtDate = (d: Date) => d.toLocaleDateString('ar-EG');
    const headers = [
      'التاريخ','الوصف','المورد','الكمية','المخصوم','المتبقي','إجمالي البيع','مدفوع من العميل','المستلم من المورد','مدين','دائن','الرصيد'
    ].map(shape);
    const body = detailedWithBalance.map(r => [
      fmtDate(r.t.date),
      r.t.description || '',
      r.t.supplierName,
      fmtNumber(r.t.quantity || 0),
      fmtNumber(((r.t.actualQuantityDeducted || 0) + (r.t.otherQuantityDeducted || 0))),
      fmtNumber(r.t.remainingQuantity || 0),
      fmtCurrency(r.saleDebit),
      fmtCurrency(r.credit),
      r.supplierDebit ? fmtCurrency(r.supplierDebit) : '-',
      fmtCurrency(r.debit),
      fmtCurrency(r.credit),
      fmtCurrency(r.balance)
    ].map(shape));
    autoTable(doc, {
      head: [headers],
      body,
      styles: { font: arabicFontFamily, fontSize: 7, halign: 'right' },
      headStyles: { font: arabicFontFamily, halign: 'right' },
      bodyStyles: { font: arabicFontFamily, halign: 'right' },
      didParseCell: (data) => {
        // طبّق التشكيل وتحويل الأرقام لأرقام عربية على كل النصوص
        const t = data.cell.text as unknown as string[] | undefined;
        if (Array.isArray(t)) {
          data.cell.text = t.map((s) => shape(String(s)));
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.text(shape(`${new Date().toLocaleString('ar-EG')}`), pageWidth - data.settings.margin.left, doc.internal.pageSize.getHeight() - 4, { align: 'right' });
      }
    });
    // إجماليات
    const totals = detailedWithBalance.reduce((acc, r) => {
      acc.debit += r.debit;
      acc.credit += r.credit;
      return acc;
    }, { debit: 0, credit: 0 });
    const finalBalance = detailedWithBalance.at(-1)?.balance || 0;
    doc.addPage('landscape');
  doc.setFontSize(14); doc.text(shape('ملخص الإجماليات'), pageWidth - 14, 14, { align: 'right' });
    doc.setFontSize(10);
  autoTable(doc, {
      head: [['مدين إجمالي','دائن إجمالي','الرصيد النهائي (دائن - مدين)']],
      body: [[fmtCurrency(totals.debit), fmtCurrency(totals.credit), fmtCurrency(finalBalance)]],
      styles: { font: arabicFontFamily, fontSize: 11, halign: 'right' },
      headStyles: { font: arabicFontFamily, halign: 'right' },
      bodyStyles: { font: arabicFontFamily, halign: 'right' }
    });
  const fileName = `تقرير-تفاصيل-العميل-${detailsCustomer}.pdf`;
    doc.save(fileName);
  // تحقق آمن من وجود دوال المشاركة قبل الاستعمال لتفادي تحذير TypeScript
  if ('share' in navigator && typeof navigator.share === 'function' && 'canShare' in navigator && typeof (navigator as any).canShare === 'function') {
      try {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        const can = (navigator as any).canShare({ files: [file] });
        if (can) {
          (navigator as any).share({ files: [file], title: title, text: 'مشاركة تفاصيل العميل PDF' });
        }
      } catch { /* ignore share errors */ }
    }
  };

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
                <TableHead>المستلم من المورد</TableHead>
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
        <DialogContent className="w-[96vw] h-[92vh] max-w-none sm:max-w-none flex flex-col">
          <DialogHeader>
            <DialogTitle>تفاصيل العميل</DialogTitle>
            <DialogDescription>عرض تفصيلي للعمليات والمدفوعات والرصيد</DialogDescription>
          </DialogHeader>
          {detailsCustomer && (
            <div className="space-y-4 flex-1 overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>اسم العميل</Label><div className="font-medium">{detailsCustomer}</div></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>الحالة تُحسب: (مدفوعات العميل − إجمالي البيع) − المستلم من المورد</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={exportCustomerDetailsPDF}>
                  <FileDown className="ml-2 h-4 w-4" />تصدير / مشاركة PDF
                </Button>
              </div>

              <div className="p-3 border rounded flex flex-col h-[calc(100%-120px)]">
                <h4 className="font-medium mb-2 shrink-0">العمليات المتعلقة بالعميل</h4>
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
                        <TableHead>المستلم من المورد</TableHead>
                        <TableHead>مدين</TableHead>
                        <TableHead>دائن</TableHead>
                        <TableHead>الرصيد (تراكمي دائن - مدين)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailedWithBalance.map(({ t, saleDebit, supplierDebit, debit, credit, creditFromCustomer, balance }) => (
                        <TableRow key={t.id}>
                          <TableCell>{format(t.date, 'yyyy-MM-dd')}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={t.description}>{t.description}</TableCell>
                          <TableCell>{t.supplierName}</TableCell>
                          <TableCell>{t.quantity} طن</TableCell>
                          <TableCell>{(((t.actualQuantityDeducted || 0) + (t.otherQuantityDeducted || 0))).toFixed(2)} طن</TableCell>
                          <TableCell>{(t.remainingQuantity || 0).toFixed(2)} طن</TableCell>
                          <TableCell>{saleDebit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                          <TableCell>{creditFromCustomer.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                          <TableCell>{supplierDebit ? supplierDebit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : '-'}</TableCell>
                          <TableCell className="text-blue-700 font-medium">{debit ? debit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : '-'}</TableCell>
                          <TableCell className="text-amber-700 font-medium">{credit ? credit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : '-'}</TableCell>
                          <TableCell className={balance >= 0 ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                            {balance.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    {detailedWithBalance.length > 0 && (() => {
                      const totals = detailedWithBalance.reduce((acc, r) => {
                        acc.debit += r.debit; // إجمالي (البيع + المستلم من المورد)
                        acc.credit += r.credit; // إجمالي مدفوعات العميل
                        return acc;
                      }, { debit: 0, credit: 0 });
                      const finalBalance = detailedWithBalance.at(-1)?.balance || 0;
                      return (
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={9} className="font-bold text-right">الإجماليات</TableCell>
                            <TableCell className="font-bold text-blue-700">{totals.debit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                            <TableCell className="font-bold text-amber-700">{totals.credit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                            <TableCell className={finalBalance >= 0 ? 'font-bold text-green-700' : 'font-bold text-red-700'}>{finalBalance.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                          </TableRow>
                        </TableFooter>
                      );
                    })()}
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
