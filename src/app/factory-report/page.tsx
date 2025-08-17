
"use client";

import React, { useMemo, useState } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Factory, DollarSign, ShoppingCart, Search } from 'lucide-react';
import { formatEGP } from '@/lib/utils';

interface FactoryReport {
  factoryName: string;
  totalQuantityPurchased: number;
  totalPurchaseValue: number;
  totalAmountPaid: number;
}

export default function FactoryReportPage() {
  const { transactions } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');

  const factoryReport = useMemo<FactoryReport[]>(() => {
    const reportMap = new Map<string, {
      totalQuantityPurchased: number;
      totalPurchaseValue: number;
      totalAmountPaid: number;
    }>();

    transactions.forEach(t => {
      // Assuming t.description holds the factory name
      const factory = t.description;
      if (!factory) return;

      const entry = reportMap.get(factory) || {
        totalQuantityPurchased: 0,
        totalPurchaseValue: 0,
        totalAmountPaid: 0,
      };

      entry.totalQuantityPurchased += t.quantity || 0;
      entry.totalPurchaseValue += t.totalPurchasePrice || 0;
      entry.totalAmountPaid += t.amountPaidToFactory || 0;
      
      reportMap.set(factory, entry);
    });

    return Array.from(reportMap.entries()).map(([factoryName, data]) => ({
      factoryName,
      ...data,
    })).sort((a, b) => a.factoryName.localeCompare(b.factoryName));
  }, [transactions]);
  
  const filteredReport = useMemo(() => {
    if (!searchTerm) {
      return factoryReport;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return factoryReport.filter(item =>
      item.factoryName.toLowerCase().includes(lowercasedFilter)
    );
  }, [factoryReport, searchTerm]);

  const totalAmountPaidToFactories = useMemo(() => {
    return filteredReport.reduce((sum, item) => sum + item.totalAmountPaid, 0);
  }, [filteredReport]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Factory className="h-8 w-8" />
          تقرير المصنع
        </h1>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المدفوع للمصانع (المفلترة)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatEGP(totalAmountPaidToFactories)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عدد المصانع (المفلترة)</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredReport.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>ملخص التعاملات مع المصانع</CardTitle>
              <CardDescription>
                عرض ملخص للمشتريات والمبالغ المدفوعة لكل مصنع.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم المصنع..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المصنع</TableHead>
                  <TableHead className="text-center">إجمالي الكمية المشتراة</TableHead>
                  <TableHead className="text-center">إجمالي قيمة المشتريات</TableHead>
                  <TableHead className="text-center text-green-600">إجمالي المبلغ المدفوع للمصنع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {searchTerm ? "لا توجد نتائج بحث مطابقة." : "لا توجد بيانات لعرضها."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReport.map((item) => (
                    <TableRow key={item.factoryName}>
                      <TableCell className="font-medium">{item.factoryName}</TableCell>
                      <TableCell className="text-center">
                        {item.totalQuantityPurchased.toFixed(2)} طن
                      </TableCell>
                      <TableCell className="text-center font-semibold text-blue-600">{formatEGP(item.totalPurchaseValue)}</TableCell>
                      <TableCell className="text-center font-bold text-green-600">{formatEGP(item.totalAmountPaid)}</TableCell>
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
