'use client';

import { useState, useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Package, AlertCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ensureArabicPdf, fmtNumberLTR, fmtCurrencyMixEGP, containsDirIsolate } from '@/lib/pdf-arabic';
import { toast } from '@/hooks/use-toast';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type LowStockItem = {
  id: string;
  category: string;
  variety: string;
  customerName: string;
  supplierName: string;
  location: string;
  remainingQuantity: number;
  remainingAmount: number;
  lastTransactionDate: Date;
  daysWithoutMovement: number;
  alertLevel: 'critical' | 'warning' | 'low';
  unitPrice: number;
};

export default function InventoryAlertsPage() {
  const { transactions } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<'all' | 'critical' | 'warning' | 'low'>('all');
  const [minQuantityThreshold, setMinQuantityThreshold] = useState(5); // طن
  const [daysThreshold, setDaysThreshold] = useState(30); // أيام

  const lowStockItems = useMemo<LowStockItem[]>(() => {
    const inventoryMap = new Map<string, {
      totalQuantity: number;
      actualQuantityDeducted: number;
      remainingAmount: number;
      lastTransactionDate: Date;
      unitPrice: number;
      data: {
        category: string;
        variety: string;
        customerName: string;
        supplierName: string;
        governorate: string;
        city: string;
      }
    }>();

    transactions.forEach(t => {
      const key = [
        t.category || 'عام',
        t.variety || 'عام',
        t.customerName || 'عام',
        t.supplierName,
        t.governorate || 'عام',
        t.city || 'عام'
      ].join('-');

      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          totalQuantity: 0,
          actualQuantityDeducted: 0,
          remainingAmount: 0,
          lastTransactionDate: t.date,
          unitPrice: t.purchasePrice || 0,
          data: {
            category: t.category || 'عام',
            variety: t.variety || 'عام',
            customerName: t.customerName || 'عام',
            supplierName: t.supplierName,
            governorate: t.governorate || 'عام',
            city: t.city || 'عام',
          }
        });
      }

      const entry = inventoryMap.get(key)!;
      entry.totalQuantity += t.quantity || 0;
      entry.actualQuantityDeducted += t.actualQuantityDeducted || 0;
      entry.remainingAmount += t.remainingAmount || 0;
      if (t.date > entry.lastTransactionDate) {
        entry.lastTransactionDate = t.date;
        entry.unitPrice = t.purchasePrice || entry.unitPrice;
      }
    });

    const now = new Date();
    return Array.from(inventoryMap.entries())
      .map(([key, value]) => {
        const remainingQuantity = value.totalQuantity - value.actualQuantityDeducted;
        const daysWithoutMovement = Math.floor((now.getTime() - value.lastTransactionDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let alertLevel: 'critical' | 'warning' | 'low' = 'low';
        if (remainingQuantity <= 1 || daysWithoutMovement >= daysThreshold * 2) {
          alertLevel = 'critical';
        } else if (remainingQuantity <= 3 || daysWithoutMovement >= daysThreshold) {
          alertLevel = 'warning';
        }

        return {
          id: key,
          ...value.data,
          location: `${value.data.governorate} - ${value.data.city}`,
          remainingQuantity,
          remainingAmount: value.remainingAmount,
          lastTransactionDate: value.lastTransactionDate,
          daysWithoutMovement,
          alertLevel,
          unitPrice: value.unitPrice
        };
      })
      .filter(item => 
        item.remainingQuantity <= minQuantityThreshold || 
        item.daysWithoutMovement >= daysThreshold
      )
      .sort((a, b) => {
        // Sort by alert level first (critical > warning > low)
        const alertOrder = { critical: 3, warning: 2, low: 1 };
        if (alertOrder[a.alertLevel] !== alertOrder[b.alertLevel]) {
          return alertOrder[b.alertLevel] - alertOrder[a.alertLevel];
        }
        // Then by remaining quantity (lowest first)
        return a.remainingQuantity - b.remainingQuantity;
      });
  }, [transactions, minQuantityThreshold, daysThreshold]);

  const filteredItems = useMemo(() => {
    return lowStockItems.filter(item => {
      const matchesSearch = !searchTerm || 
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAlert = selectedAlert === 'all' || item.alertLevel === selectedAlert;
      
      return matchesSearch && matchesAlert;
    });
  }, [lowStockItems, searchTerm, selectedAlert]);

  const summary = useMemo(() => {
    const critical = filteredItems.filter(item => item.alertLevel === 'critical').length;
    const warning = filteredItems.filter(item => item.alertLevel === 'warning').length;
    const low = filteredItems.filter(item => item.alertLevel === 'low').length;
    const totalValue = filteredItems.reduce((sum, item) => sum + item.remainingAmount, 0);
    
    return { critical, warning, low, totalValue, totalItems: filteredItems.length };
  }, [filteredItems]);

  const exportToPDF = async () => {
  const pdf = new jsPDF({ orientation: 'landscape' });
    const { fontFamily, shape, usedCustomFont } = await ensureArabicPdf(pdf);
    if (!usedCustomFont) toast({ title: 'تحذير', description: 'لم يتم تحميل خط عربي. ضع Amiri-Regular.ttf في public/fonts/ لتحسين التصدير.', variant: 'destructive' as any });

    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(16);
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.text(shape('تنبيهات المخزون'), pageWidth - 20, 20, { align: 'right' });

    // Summary
  pdf.setFontSize(12);
  const rightX = pageWidth - 20;
  pdf.text(shape(`تنبيهات حرجة: ${summary.critical}`), rightX, 40, { align: 'right' });
  pdf.text(shape(`تنبيهات تحذيرية: ${summary.warning}`), rightX, 50, { align: 'right' });
  pdf.text(shape(`تنبيهات منخفضة: ${summary.low}`), rightX, 60, { align: 'right' });
  pdf.text(shape(`إجمالي القيمة المعرضة للخطر: ${summary.totalValue.toLocaleString('ar-EG')} ج.م`), rightX, 70, { align: 'right' });
    
    // Table
    const tableData = filteredItems.map(item => [
      item.category,
      item.variety,
      item.supplierName,
      fmtNumberLTR(item.remainingQuantity, 2),
      fmtNumberLTR(item.daysWithoutMovement, 0),
      item.alertLevel === 'critical' ? 'حرج' : item.alertLevel === 'warning' ? 'تحذير' : 'منخفض',
      fmtCurrencyMixEGP(item.remainingAmount, 2)
    ]);

    (pdf as any).autoTable({
      startY: 80,
      head: [['الصنف', 'النوع', 'المورد', 'الكمية المتبقية', 'أيام بلا حركة', 'مستوى التنبيه', 'القيمة']],
      body: tableData,
      styles: { font: fontFamily, halign: 'right', fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { font: fontFamily, halign: 'right' },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 32 },
        2: { cellWidth: 40 },
        3: { cellWidth: 28 },
        4: { cellWidth: 28 },
        5: { cellWidth: 28 },
        6: { cellWidth: 36 },
      },
      didParseCell: (data: any) => {
        const t = data.cell.text as string[] | undefined;
        if (Array.isArray(t)) data.cell.text = t.map(s => {
          const str = String(s)
          return containsDirIsolate(str) ? str : shape(str)
        });
      }
    });

    pdf.save('inventory-alerts.pdf');
  };

  const getAlertBadge = (alertLevel: string) => {
    switch (alertLevel) {
      case 'critical':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />حرج</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-800"><AlertCircle className="h-3 w-3" />تحذير</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><TrendingDown className="h-3 w-3" />منخفض</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          تنبيهات المخزون
        </h1>
        <Button onClick={exportToPDF} className="gap-2">
          <Download className="h-4 w-4" />
          تصدير PDF
        </Button>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4 mb-8">
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تنبيهات حرجة</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary.critical}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تنبيهات تحذيرية</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summary.warning}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تنبيهات منخفضة</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary.low}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي القيمة المعرضة</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalValue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>إعدادات التنبيهات والتصفية</CardTitle>
          <CardDescription>اضبط حدود التنبيهات وصفي البيانات</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">البحث النصي</label>
              <Input
                placeholder="ابحث في الأصناف، الموردين..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">مستوى التنبيه</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={selectedAlert}
                onChange={(e) => setSelectedAlert(e.target.value as any)}
              >
                <option value="all">كل التنبيهات</option>
                <option value="critical">حرج فقط</option>
                <option value="warning">تحذير فقط</option>
                <option value="low">منخفض فقط</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">حد الكمية (طن)</label>
              <Input
                type="number"
                value={minQuantityThreshold}
                onChange={(e) => setMinQuantityThreshold(Number(e.target.value))}
                min="1"
                max="50"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">أيام بلا حركة</label>
              <Input
                type="number"
                value={daysThreshold}
                onChange={(e) => setDaysThreshold(Number(e.target.value))}
                min="7"
                max="365"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>بنود المخزون المحتاجة لاهتمام</CardTitle>
          <CardDescription>
            الأصناف ذات الكميات المنخفضة أو التي لم تسجل حركة لفترة طويلة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">مستوى التنبيه</TableHead>
                  <TableHead className="text-center">الصنف / النوع</TableHead>
                  <TableHead className="text-center">المورد / العميل</TableHead>
                  <TableHead className="text-center">الموقع</TableHead>
                  <TableHead className="text-center text-blue-600">الكمية المتبقية</TableHead>
                  <TableHead className="text-center">أيام بلا حركة</TableHead>
                  <TableHead className="text-center">آخر تحديث</TableHead>
                  <TableHead className="text-center text-green-600">القيمة المتبقية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      {searchTerm || selectedAlert !== 'all' ? "لا توجد نتائج مطابقة للتصفية." : "لا توجد تنبيهات مخزون حالياً."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className={
                      item.alertLevel === 'critical' ? 'bg-red-50' :
                      item.alertLevel === 'warning' ? 'bg-orange-50' : 'bg-blue-50'
                    }>
                      <TableCell className="text-center">
                        {getAlertBadge(item.alertLevel)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.category}</div>
                        <div className="text-xs text-muted-foreground">{item.variety}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{item.customerName}</div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.location}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        <span className={
                          item.remainingQuantity <= 1 ? 'text-red-600' :
                          item.remainingQuantity <= 3 ? 'text-orange-600' : 'text-blue-600'
                        }>
                          {item.remainingQuantity.toFixed(2)} طن
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={
                          item.daysWithoutMovement >= daysThreshold * 2 ? 'text-red-600 font-bold' :
                          item.daysWithoutMovement >= daysThreshold ? 'text-orange-600 font-bold' : 'text-gray-600'
                        }>
                          {item.daysWithoutMovement} يوم
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {format(item.lastTransactionDate, 'yyyy-MM-dd', { locale: ar })}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-bold">
                        {item.remainingAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
