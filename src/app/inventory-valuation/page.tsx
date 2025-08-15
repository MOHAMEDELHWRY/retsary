'use client';

import { useState, useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, TrendingUp, TrendingDown, DollarSign, Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ensureArabicPdf, fmtNumberLTR, fmtPercentLTR, fmtCurrencyMixEGP, containsDirIsolate } from '@/lib/pdf-arabic';
import { toast } from '@/hooks/use-toast';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type InventoryValuation = {
  id: string;
  category: string;
  variety: string;
  customerName: string;
  supplierName: string;
  location: string;
  remainingQuantity: number;
  unitCost: number; // متوسط تكلفة الوحدة
  totalValue: number; // إجمالي القيمة (الكمية × متوسط التكلفة)
  marketValue: number; // القيمة السوقية المقدرة
  gainLoss: number; // الربح/الخسارة المحتملة
  gainLossPercentage: number;
  lastTransactionDate: Date;
  totalInvestment: number; // إجمالي الاستثمار في هذا البند
  roi: number; // العائد على الاستثمار المحتمل
};

export default function InventoryValuationPage() {
  const { transactions } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [marketPriceMultiplier, setMarketPriceMultiplier] = useState(1.15); // افتراضياً 15% زيادة عن سعر الشراء

  const inventoryValuation = useMemo<InventoryValuation[]>(() => {
    const inventoryMap = new Map<string, {
      totalQuantity: number;
      actualQuantityDeducted: number;
      totalInvestment: number;
      weightedAverageCost: number;
      lastTransactionDate: Date;
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
          totalInvestment: 0,
          weightedAverageCost: 0,
          lastTransactionDate: t.date,
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
      const quantity = t.quantity || 0;
      const purchaseValue = t.totalPurchasePrice || 0;
      
      if (quantity > 0) {
        // حساب المتوسط المرجح للتكلفة
        const currentTotalValue = entry.totalQuantity * entry.weightedAverageCost;
        const newTotalValue = currentTotalValue + purchaseValue;
        const newTotalQuantity = entry.totalQuantity + quantity;
        
        entry.weightedAverageCost = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;
        entry.totalQuantity = newTotalQuantity;
        entry.totalInvestment += purchaseValue;
      }
      
      entry.actualQuantityDeducted += t.actualQuantityDeducted || 0;
      
      if (t.date > entry.lastTransactionDate) {
        entry.lastTransactionDate = t.date;
      }
    });

    return Array.from(inventoryMap.entries())
      .map(([key, value]) => {
        const remainingQuantity = value.totalQuantity - value.actualQuantityDeducted;
        const totalValue = remainingQuantity * value.weightedAverageCost;
        const marketValue = remainingQuantity * value.weightedAverageCost * marketPriceMultiplier;
        const gainLoss = marketValue - totalValue;
        const gainLossPercentage = totalValue > 0 ? (gainLoss / totalValue) * 100 : 0;
        const roi = value.totalInvestment > 0 ? ((marketValue - value.totalInvestment) / value.totalInvestment) * 100 : 0;

        return {
          id: key,
          ...value.data,
          location: `${value.data.governorate} - ${value.data.city}`,
          remainingQuantity,
          unitCost: value.weightedAverageCost,
          totalValue,
          marketValue,
          gainLoss,
          gainLossPercentage,
          lastTransactionDate: value.lastTransactionDate,
          totalInvestment: value.totalInvestment,
          roi
        };
      })
      .filter(item => item.remainingQuantity > 0.01)
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [transactions, marketPriceMultiplier]);

  const filteredItems = useMemo(() => {
    return inventoryValuation.filter(item => {
      const matchesSearch = !searchTerm || 
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [inventoryValuation, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    return Array.from(new Set(inventoryValuation.map(item => item.category))).sort();
  }, [inventoryValuation]);

  const summary = useMemo(() => {
    const totalCostValue = filteredItems.reduce((sum, item) => sum + item.totalValue, 0);
    const totalMarketValue = filteredItems.reduce((sum, item) => sum + item.marketValue, 0);
    const totalGainLoss = totalMarketValue - totalCostValue;
    const totalInvestment = filteredItems.reduce((sum, item) => sum + item.totalInvestment, 0);
    const overallROI = totalInvestment > 0 ? ((totalMarketValue - totalInvestment) / totalInvestment) * 100 : 0;
    const profitableItems = filteredItems.filter(item => item.gainLoss > 0).length;
    
    return { 
      totalCostValue, 
      totalMarketValue, 
      totalGainLoss, 
      totalInvestment,
      overallROI,
      profitableItems,
      totalItems: filteredItems.length 
    };
  }, [filteredItems]);

  const exportToPDF = async () => {
  const pdf = new jsPDF({ orientation: 'landscape' });

    const { fontFamily, shape, usedCustomFont } = await ensureArabicPdf(pdf);
    if (!usedCustomFont) toast({ title: 'تحذير', description: 'لم يتم تحميل خط عربي. سيتم تصدير PDF بخط افتراضي وقد تظهر الأحرف بشكل غير صحيح. ضع Amiri-Regular.ttf في public/fonts/', variant: 'destructive' as any });

    // Title
    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(16);
    const title = shape('تقرير تقييم المخزون');
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.text(title, pageWidth - 20, 20, { align: 'right' });

    // Summary
    pdf.setFontSize(12);
    const summaryLines = [
      shape(`إجمالي القيمة التكلفة: ${summary.totalCostValue.toLocaleString('ar-EG')} ج.م`),
      shape(`إجمالي القيمة السوقية: ${summary.totalMarketValue.toLocaleString('ar-EG')} ج.م`),
      shape(`صافي الربح/الخسارة: ${summary.totalGainLoss.toLocaleString('ar-EG')} ج.م`),
      shape(`العائد على الاستثمار: ${summary.overallROI.toFixed(2)}%`),
    ];
    summaryLines.forEach((line, i) => {
      pdf.text(line, pageWidth - 20, 40 + i * 10, { align: 'right' });
    });

    // Table
    const tableData = filteredItems.map(item => [
      shape(item.category),
      shape(item.variety),
      shape(item.supplierName),
      fmtNumberLTR(item.remainingQuantity, 2),
      fmtCurrencyMixEGP(item.unitCost, 2),
      fmtCurrencyMixEGP(item.totalValue, 2),
      fmtCurrencyMixEGP(item.marketValue, 2),
      fmtPercentLTR(item.gainLossPercentage, 1)
    ]);

    (pdf as any).autoTable({
      startY: 80,
      head: [[shape('الصنف'), shape('النوع'), shape('المورد'), shape('الكمية'), shape('التكلفة/وحدة'), shape('القيمة الدفترية'), shape('القيمة السوقية'), shape('نسبة الربح/الخسارة')]],
      body: tableData,
      styles: { 
        font: fontFamily,
        halign: 'right',
        fontSize: 9,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: { halign: 'right', fillColor: [46, 125, 50], font: fontFamily },
      columnStyles: {
        0: { cellWidth: 40 }, // الصنف
        1: { cellWidth: 32 }, // النوع
        2: { cellWidth: 38 }, // المورد
        3: { cellWidth: 25 }, // الكمية
        4: { cellWidth: 28 }, // التكلفة/وحدة
        5: { cellWidth: 32 }, // القيمة الدفترية
        6: { cellWidth: 32 }, // القيمة السوقية
        7: { cellWidth: 28 }, // نسبة الربح/الخسارة
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data: any) => {
        const t = data.cell.text as string[] | undefined;
        if (Array.isArray(t)) data.cell.text = t.map(s => {
          const str = String(s)
          return containsDirIsolate(str) ? str : shape(str)
        });
      }
    });

    pdf.save('inventory-valuation-report.pdf');
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <BarChart className="h-8 w-8" />
          تقييم المخزون
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
            <CardTitle className="text-sm font-medium">القيمة الدفترية</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary.totalCostValue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">القيمة السوقية</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.totalMarketValue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">صافي الربح/الخسارة</CardTitle>
            {summary.totalGainLoss >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.totalGainLoss.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">العائد على الاستثمار</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.overallROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.overallROI.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>إعدادات التقييم والتصفية</CardTitle>
          <CardDescription>اضبط معايير التقييم وصفي البيانات</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">البحث النصي</label>
              <Input
                placeholder="ابحث في الأصناف، الموردين..."
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
            <div>
              <label className="text-sm font-medium mb-2 block">معامل السعر السوقي</label>
              <Input
                type="number"
                step="0.01"
                value={marketPriceMultiplier}
                onChange={(e) => setMarketPriceMultiplier(Number(e.target.value))}
                min="0.5"
                max="2"
              />
              <div className="text-xs text-muted-foreground mt-1">
                (1.0 = سعر التكلفة، 1.15 = +15% زيادة)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Valuation Table */}
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل تقييم المخزون</CardTitle>
          <CardDescription>
            تقييم مفصل للمخزون بناءً على التكلفة والقيمة السوقية المقدرة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">الصنف / النوع</TableHead>
                  <TableHead className="text-center">المورد / العميل</TableHead>
                  <TableHead className="text-center">الموقع</TableHead>
                  <TableHead className="text-center">الكمية المتبقية</TableHead>
                  <TableHead className="text-center">متوسط التكلفة/وحدة</TableHead>
                  <TableHead className="text-center text-blue-600">القيمة الدفترية</TableHead>
                  <TableHead className="text-center text-green-600">القيمة السوقية</TableHead>
                  <TableHead className="text-center">الربح/الخسارة</TableHead>
                  <TableHead className="text-center">العائد على الاستثمار</TableHead>
                  <TableHead className="text-center">آخر تحديث</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      {searchTerm || selectedCategory ? "لا توجد نتائج مطابقة للتصفية." : "لا يوجد مخزون لتقييمه."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
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
                        {item.remainingQuantity.toFixed(2)} طن
                      </TableCell>
                      <TableCell className="text-center">
                        {item.unitCost.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-bold">
                        {item.totalValue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-bold">
                        {item.marketValue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={`font-bold ${item.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.gainLoss.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                        </div>
                        <div className={`text-xs ${item.gainLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.gainLossPercentage >= 0 ? '+' : ''}{item.gainLossPercentage.toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.roi >= 0 ? 'default' : 'destructive'}>
                          {item.roi >= 0 ? '+' : ''}{item.roi.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {format(item.lastTransactionDate, 'yyyy-MM-dd', { locale: ar })}
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
