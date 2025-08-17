'use client';

import { useState, useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Package, TrendingDown, TrendingUp, Activity, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ensureArabicPdf, fmtNumberLTR, fmtCurrencyMixEGP, containsDirIsolate } from '@/lib/pdf-arabic';
import { toast } from '@/hooks/use-toast';
import { formatEGP } from '@/lib/utils';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type InventoryMovement = {
  id: string;
  date: Date;
  transactionNumber: string;
  type: 'إدخال' | 'إخراج';
  category: string;
  variety: string;
  customerName: string;
  supplierName: string;
  location: string;
  quantityIn: number;
  quantityOut: number;
  remainingQuantity: number;
  unitPrice: number;
  totalValue: number;
  notes?: string;
};

export default function InventoryMovementPage() {
  const { transactions } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const inventoryMovements = useMemo<InventoryMovement[]>(() => {
    const movements: InventoryMovement[] = [];
    
    // Group transactions by inventory key to track cumulative quantities
    const inventoryTracker = new Map<string, number>();
    
    // Sort transactions by date to process chronologically
    const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    sortedTransactions.forEach(t => {
      const inventoryKey = [
        t.category || 'عام',
        t.variety || 'عام', 
        t.customerName || 'عام',
        t.supplierName,
        t.governorate || 'عام',
        t.city || 'عام'
      ].join('-');
      
      // Initialize tracker if not exists
      if (!inventoryTracker.has(inventoryKey)) {
        inventoryTracker.set(inventoryKey, 0);
      }
      
      // Calculate quantities
      const quantityIn = t.quantity || 0;
      const quantityOut = t.actualQuantityDeducted || 0;
      
      // Stock entry movement (إدخال)
      if (quantityIn > 0) {
        inventoryTracker.set(inventoryKey, inventoryTracker.get(inventoryKey)! + quantityIn);
        movements.push({
          id: `${t.id}-in`,
          date: t.date,
          transactionNumber: t.transactionNumber || t.operationNumber || `OP-${t.id}`,
          type: 'إدخال',
          category: t.category || 'عام',
          variety: t.variety || 'عام',
          customerName: t.customerName || 'عام',
          supplierName: t.supplierName,
          location: `${t.governorate || 'عام'} - ${t.city || 'عام'}`,
          quantityIn,
          quantityOut: 0,
          remainingQuantity: inventoryTracker.get(inventoryKey)!,
          unitPrice: t.purchasePrice || 0,
          totalValue: quantityIn * (t.purchasePrice || 0),
          notes: t.description
        });
      }
      
      // Stock exit movement (إخراج)
      if (quantityOut > 0) {
        inventoryTracker.set(inventoryKey, inventoryTracker.get(inventoryKey)! - quantityOut);
        movements.push({
          id: `${t.id}-out`,
          date: t.date,
          transactionNumber: t.transactionNumber || t.operationNumber || `OP-${t.id}`,
          type: 'إخراج',
          category: t.category || 'عام',
          variety: t.variety || 'عام',
          customerName: t.customerName || 'عام',
          supplierName: t.supplierName,
          location: `${t.governorate || 'عام'} - ${t.city || 'عام'}`,
          quantityIn: 0,
          quantityOut,
          remainingQuantity: inventoryTracker.get(inventoryKey)!,
          unitPrice: t.purchasePrice || 0,
          totalValue: quantityOut * (t.purchasePrice || 0),
          notes: `خصم من: ${t.description}`
        });
      }
    });
    
    return movements.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions]);

  const filteredMovements = useMemo(() => {
    return inventoryMovements.filter(movement => {
      const matchesSearch = !searchTerm || 
        movement.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || movement.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [inventoryMovements, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    return Array.from(new Set(inventoryMovements.map(m => m.category))).sort();
  }, [inventoryMovements]);

  const summary = useMemo(() => {
    const totalIn = filteredMovements.reduce((sum, m) => sum + m.quantityIn, 0);
    const totalOut = filteredMovements.reduce((sum, m) => sum + m.quantityOut, 0);
    const totalValue = filteredMovements.reduce((sum, m) => sum + m.totalValue, 0);
    
    return { totalIn, totalOut, totalValue, movementCount: filteredMovements.length };
  }, [filteredMovements]);

  const exportToPDF = async () => {
  const pdf = new jsPDF({ orientation: 'landscape' });
    const { fontFamily, shape, usedCustomFont } = await ensureArabicPdf(pdf);
    if (!usedCustomFont) toast({ title: 'تحذير', description: 'لم يتم تحميل خط عربي. ضع Amiri-Regular.ttf في public/fonts/ لتحسين التصدير.', variant: 'destructive' as any });

    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(16);
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.text(shape('حركة المخزون'), pageWidth - 20, 20, { align: 'right' });
    
    // Summary
  pdf.setFontSize(12);
  const rightX = pageWidth - 20;
  pdf.text(shape(`إجمالي الإدخال: ${summary.totalIn.toFixed(2)} طن`), rightX, 40, { align: 'right' });
  pdf.text(shape(`إجمالي الإخراج: ${summary.totalOut.toFixed(2)} طن`), rightX, 50, { align: 'right' });
  pdf.text(shape(`إجمالي القيمة: ${summary.totalValue.toLocaleString('ar-EG-u-nu-latn', { style: 'currency', currency: 'EGP' })}`), rightX, 60, { align: 'right' });
  pdf.text(shape(`إجمالي القيمة: ${formatEGP(summary.totalValue)}`), rightX, 60, { align: 'right' });
  pdf.text(shape(`عدد الحركات: ${summary.movementCount}`), rightX, 70, { align: 'right' });
    
    // Table
    const tableData = filteredMovements.map(movement => [
      fmtNumberLTR(Number(format(movement.date, 'yyyyMMdd')), 0),
      movement.transactionNumber,
      movement.type,
      movement.category,
      movement.variety,
      movement.supplierName,
      fmtNumberLTR(movement.quantityIn, 2),
      fmtNumberLTR(movement.quantityOut, 2),
      fmtNumberLTR(movement.remainingQuantity, 2),
      fmtCurrencyMixEGP(movement.totalValue, 2)
    ]);

    (pdf as any).autoTable({
      startY: 80,
      head: [['التاريخ', 'رقم العملية', 'النوع', 'الصنف', 'النوع', 'المورد', 'إدخال', 'إخراج', 'الرصيد', 'القيمة']],
      body: tableData,
      styles: { font: fontFamily, halign: 'right', fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { font: fontFamily, halign: 'right' },
      columnStyles: {
        0: { cellWidth: 24 }, // التاريخ
        1: { cellWidth: 32 }, // رقم العملية
        2: { cellWidth: 22 }, // النوع
        3: { cellWidth: 34 }, // الصنف
        4: { cellWidth: 28 }, // النوع (التصنيف)
        5: { cellWidth: 34 }, // المورد
        6: { cellWidth: 22 }, // إدخال
        7: { cellWidth: 22 }, // إخراج
        8: { cellWidth: 24 }, // الرصيد
        9: { cellWidth: 34 }, // القيمة
      },
      didParseCell: (data: any) => {
        const t = data.cell.text as string[] | undefined;
        if (Array.isArray(t)) data.cell.text = t.map(s => {
          const str = String(s)
          return containsDirIsolate(str) ? str : shape(str)
        });
      }
    });

    pdf.save('inventory-movement.pdf');
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Activity className="h-8 w-8" />
          سجل حركات المخزون
        </h1>
        <Button onClick={exportToPDF} className="gap-2">
          <Download className="h-4 w-4" />
          تصدير PDF
        </Button>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإدخال</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.totalIn.toFixed(2)} طن
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإخراج</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary.totalOut.toFixed(2)} طن
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي القيمة</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary.totalValue.toLocaleString('ar-EG-u-nu-latn', { style: 'currency', currency: 'EGP' })}
                {formatEGP(summary.totalValue)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عدد الحركات</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.movementCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>تصفية البيانات</CardTitle>
          <CardDescription>ابحث وصفي البيانات حسب الحاجة</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">البحث النصي</label>
              <Input
                placeholder="ابحث في الأصناف، الموردين، الموقع، رقم العملية..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">تصفية حسب الصنف</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">كل الأصناف</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل حركات المخزون</CardTitle>
          <CardDescription>
            سجل تفصيلي لجميع عمليات الإدخال والإخراج مع تتبع الأرصدة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">التاريخ</TableHead>
                  <TableHead className="text-center">رقم العملية</TableHead>
                  <TableHead className="text-center">نوع الحركة</TableHead>
                  <TableHead className="text-center">الصنف / النوع</TableHead>
                  <TableHead className="text-center">المورد / العميل</TableHead>
                  <TableHead className="text-center">الموقع</TableHead>
                  <TableHead className="text-center text-green-600">كمية الإدخال</TableHead>
                  <TableHead className="text-center text-red-600">كمية الإخراج</TableHead>
                  <TableHead className="text-center text-blue-600">الرصيد المتبقي</TableHead>
                  <TableHead className="text-center">القيمة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      {searchTerm || selectedCategory ? "لا توجد نتائج مطابقة للتصفية." : "لا توجد حركات مخزون لعرضها."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-center">
                        {format(movement.date, 'yyyy-MM-dd', { locale: ar })}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {movement.transactionNumber}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={movement.type === 'إدخال' ? 'default' : 'destructive'}>
                          {movement.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{movement.category}</div>
                        <div className="text-xs text-muted-foreground">{movement.variety}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{movement.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{movement.customerName}</div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {movement.location}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-bold">
                        {movement.quantityIn > 0 ? `${movement.quantityIn.toFixed(2)} طن` : '-'}
                      </TableCell>
                      <TableCell className="text-center text-red-600 font-bold">
                        {movement.quantityOut > 0 ? `${movement.quantityOut.toFixed(2)} طن` : '-'}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-bold">
                        {movement.remainingQuantity.toFixed(2)} طن
                      </TableCell>
                      <TableCell className="text-center">
                        {formatEGP(movement.totalValue)}
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
