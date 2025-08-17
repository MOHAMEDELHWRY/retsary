"use client";

import { useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEGP } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';

interface SupplierSummaryRow {
  supplierName: string;
  totalPurchases: number;          // إجمالي الشراء
  totalPaidToFactory: number;      // مدفوع للمصنع (من نفس عمليات المورد)
  remainingQuantity: number;       // الكمية المتبقية (مجموع remainingQuantity)
  remainingAmount: number;         // المبلغ المتبقي (مجموع remainingAmount)
  totalSales: number;              // إجمالي البيع
  totalExpenses: number;           // المصروفات المرتبطة بالمورد
  netProfit: number;               // صافي الربح = إجمالي البيع - إجمالي الشراء - المصروفات
}

export default function SuppliersReportPage() {
  const { transactions, expenses, suppliers } = useTransactions();

  const data = useMemo<SupplierSummaryRow[]>(() => {
    const map = new Map<string, SupplierSummaryRow>();
    // Initialize from suppliers list so يظهر حتى لو ما في عمليات
    (suppliers || []).forEach(s => {
      if (!map.has(s.name)) {
        map.set(s.name, {
          supplierName: s.name,
          totalPurchases: 0,
            totalPaidToFactory: 0,
          remainingQuantity: 0,
          remainingAmount: 0,
          totalSales: 0,
          totalExpenses: 0,
          netProfit: 0,
        });
      }
    });
    // Aggregate transactions
    transactions.forEach(t => {
      const row = map.get(t.supplierName) || {
        supplierName: t.supplierName,
        totalPurchases: 0,
        totalPaidToFactory: 0,
        remainingQuantity: 0,
        remainingAmount: 0,
        totalSales: 0,
        totalExpenses: 0,
        netProfit: 0,
      };
      row.totalPurchases += t.totalPurchasePrice || 0;
      const paidList = (t.factoryPayments || []).reduce((s,p)=> s + (p.amount || 0),0);
      row.totalPaidToFactory += (t.amountPaidToFactory || 0) + paidList;
      row.remainingQuantity += t.remainingQuantity || 0;
      row.remainingAmount += t.remainingAmount || 0;
      row.totalSales += t.totalSellingPrice || 0;
      row.netProfit = (row.totalSales - row.totalPurchases) - row.totalExpenses; // interim
      map.set(t.supplierName, row);
    });
    // Aggregate expenses (supplierName موجود داخل Expense)
    (expenses || []).forEach(exp => {
      if (!exp.supplierName) return;
      const row = map.get(exp.supplierName) || {
        supplierName: exp.supplierName,
        totalPurchases: 0,
        totalPaidToFactory: 0,
        remainingQuantity: 0,
        remainingAmount: 0,
        totalSales: 0,
        totalExpenses: 0,
        netProfit: 0,
      };
      row.totalExpenses += exp.amount || 0;
      row.netProfit = (row.totalSales - row.totalPurchases) - row.totalExpenses;
      map.set(exp.supplierName, row);
    });
    // Final netProfit recalculation to ensure correctness
    map.forEach(r => { r.netProfit = (r.totalSales - r.totalPurchases) - r.totalExpenses; });
    return Array.from(map.values()).sort((a,b)=> a.supplierName.localeCompare(b.supplierName));
  }, [transactions, expenses, suppliers]);

  // Totals
  const totals = data.reduce((acc, r) => {
    acc.totalPurchases += r.totalPurchases;
    acc.totalPaidToFactory += r.totalPaidToFactory;
    acc.remainingQuantity += r.remainingQuantity;
    acc.remainingAmount += r.remainingAmount;
    acc.totalSales += r.totalSales;
    acc.totalExpenses += r.totalExpenses;
    acc.netProfit += r.netProfit;
    return acc;
  }, { totalPurchases:0,totalPaidToFactory:0,remainingQuantity:0,remainingAmount:0,totalSales:0,totalExpenses:0,netProfit:0 });

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Users className="h-8 w-8" />
          تقرير الموردين (ملخص مالي)
        </h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>جدول ملخص المورد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المورد</TableHead>
                  <TableHead className="text-center">مدفوع للمصنع</TableHead>
                  <TableHead className="text-center">إجمالي الشراء</TableHead>
                  <TableHead className="text-center">الكمية المتبقية (طن)</TableHead>
                  <TableHead className="text-center">المبلغ المتبقي</TableHead>
                  <TableHead className="text-center">إجمالي البيع</TableHead>
                  <TableHead className="text-center">المصروفات</TableHead>
                  <TableHead className="text-center">صافي الربح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد بيانات</TableCell>
                  </TableRow>
                )}
                {data.map(r => (
                  <TableRow key={r.supplierName}>
                    <TableCell className="font-medium">{r.supplierName}</TableCell>
                    <TableCell className="text-center text-blue-600 font-semibold">{formatEGP(r.totalPaidToFactory)}</TableCell>
                    <TableCell className="text-center">{formatEGP(r.totalPurchases)}</TableCell>
                    <TableCell className="text-center text-indigo-600 font-semibold">{r.remainingQuantity.toFixed(2)}</TableCell>
                    <TableCell className="text-center text-green-600 font-semibold">{formatEGP(r.remainingAmount)}</TableCell>
                    <TableCell className="text-center text-emerald-600 font-semibold">{formatEGP(r.totalSales)}</TableCell>
                    <TableCell className="text-center text-red-600 font-semibold">{formatEGP(r.totalExpenses)}</TableCell>
                    <TableCell className={`text-center font-bold ${r.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatEGP(r.netProfit)}</TableCell>
                  </TableRow>
                ))}
                {data.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>الإجمالي</TableCell>
                    <TableCell className="text-center">{formatEGP(totals.totalPaidToFactory)}</TableCell>
                    <TableCell className="text-center">{formatEGP(totals.totalPurchases)}</TableCell>
                    <TableCell className="text-center">{totals.remainingQuantity.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{formatEGP(totals.remainingAmount)}</TableCell>
                    <TableCell className="text-center">{formatEGP(totals.totalSales)}</TableCell>
                    <TableCell className="text-center">{formatEGP(totals.totalExpenses)}</TableCell>
                    <TableCell className={`text-center ${totals.netProfit >=0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatEGP(totals.netProfit)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
