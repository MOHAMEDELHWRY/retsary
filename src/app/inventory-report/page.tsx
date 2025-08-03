"use client";

import React, { useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { type InventoryBalance } from '@/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, DollarSign, Archive } from 'lucide-react';
import { format } from 'date-fns';

export default function InventoryReportPage() {
  const { transactions } = useTransactions();

  const inventoryBalances = useMemo<InventoryBalance[]>(() => {
    const inventoryMap = new Map<string, {
      totalQuantity: number;
      totalAmount: number;
      actualQuantityDeducted: number;
      remainingAmount: number;
      lastTransactionDate: Date;
      lastTransactionNumber?: string;
      transactionIds: Set<string>;
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
        t.category || 'N/A',
        t.variety || 'N/A',
        t.customerName || 'N/A',
        t.supplierName,
        t.governorate || 'N/A',
        t.city || 'N/A'
      ].join('-');

      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          totalQuantity: 0,
          totalAmount: 0,
          actualQuantityDeducted: 0,
          remainingAmount: 0,
          lastTransactionDate: t.date,
          lastTransactionNumber: t.transactionNumber || t.operationNumber,
          transactionIds: new Set(),
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
      entry.totalAmount += t.totalPurchasePrice || 0;
      entry.actualQuantityDeducted += t.actualQuantityDeducted || 0;
      entry.remainingAmount += t.remainingAmount || 0;
      if (t.date > entry.lastTransactionDate) {
        entry.lastTransactionDate = t.date;
        entry.lastTransactionNumber = t.transactionNumber || t.operationNumber;
      }
      entry.transactionIds.add(t.id);
    });

    return Array.from(inventoryMap.entries()).map(([key, value]) => ({
      id: key,
      ...value.data,
      totalQuantity: value.totalQuantity,
      totalAmount: value.totalAmount,
      actualQuantityDeducted: value.actualQuantityDeducted,
      remainingQuantity: value.totalQuantity - value.actualQuantityDeducted,
      remainingAmount: value.remainingAmount,
      lastTransactionDate: value.lastTransactionDate,
      lastTransactionNumber: value.lastTransactionNumber,
    })).filter(balance => balance.remainingQuantity > 0.01); // Filter out empty or negligible balances
  }, [transactions]);
  
  const totalRemainingValue = useMemo(() => {
    return inventoryBalances.reduce((sum, balance) => sum + balance.remainingAmount, 0);
  }, [inventoryBalances]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Package className="h-8 w-8" />
          تقرير المخزون التراكمي
        </h1>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي قيمة المخزون المتبقي</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalRemainingValue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عدد بنود المخزون المتبقية</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inventoryBalances.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أرصدة المخزون الحالية</CardTitle>
          <CardDescription>
            عرض للكميات والمبالغ المتبقية في المخزون مجمعة حسب الصنف، النوع، العميل، المورد، والمنطقة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف / النوع</TableHead>
                  <TableHead>المورد / العميل</TableHead>
                  <TableHead>المنطقة</TableHead>
                  <TableHead className="text-center">الكمية الإجمالية</TableHead>
                  <TableHead className="text-center">الكمية المخصومة</TableHead>
                  <TableHead className="text-center text-blue-600">الكمية المتبقية</TableHead>
                  <TableHead className="text-center text-green-600">المبلغ المتبقي</TableHead>
                  <TableHead className="text-center">آخر تحديث</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryBalances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      لا يوجد مخزون متبقي لعرضه.
                    </TableCell>
                  </TableRow>
                ) : (
                  inventoryBalances.map((balance) => (
                    <TableRow key={balance.id}>
                      <TableCell>
                        <div className="font-medium">{balance.category}</div>
                        <div className="text-xs text-muted-foreground">{balance.variety}</div>
                      </TableCell>
                       <TableCell>
                        <div className="font-medium">{balance.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{balance.customerName}</div>
                      </TableCell>
                      <TableCell>
                         <div className="font-medium">{balance.governorate}</div>
                        <div className="text-xs text-muted-foreground">{balance.city}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        {balance.totalQuantity.toFixed(2)} طن
                      </TableCell>
                      <TableCell className="text-center text-orange-600">
                        {balance.actualQuantityDeducted.toFixed(2)} طن
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-bold">
                        {balance.remainingQuantity.toFixed(2)} طن
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-bold">
                        {balance.remainingAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                      </TableCell>
                      <TableCell className="text-center">
                        {format(balance.lastTransactionDate, 'yyyy-MM-dd')}
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
