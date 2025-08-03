
"use client";

import { useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import Link from 'next/link';

interface SupplierReport {
  supplierName: string;
  totalPurchases: number;
  totalPaid: number;
  balance: number;
  balanceType: 'debtor' | 'creditor' | 'balanced';
}

export default function SuppliersReportPage() {
  const { transactions, supplierPayments } = useTransactions();

  const suppliersReport = useMemo<SupplierReport[]>(() => {
    const reportMap = new Map<string, { totalPurchases: number; totalPaid: number }>();

    // Aggregate total purchases from transactions
    transactions.forEach(transaction => {
      const supplierData = reportMap.get(transaction.supplierName) || { totalPurchases: 0, totalPaid: 0 };
      supplierData.totalPurchases += transaction.totalPurchasePrice;
      reportMap.set(transaction.supplierName, supplierData);
    });

    // Aggregate total payments to suppliers
    supplierPayments.forEach(payment => {
      const supplierData = reportMap.get(payment.supplierName) || { totalPurchases: 0, totalPaid: 0 };
      supplierData.totalPaid += payment.amount;
      reportMap.set(payment.supplierName, supplierData);
    });

    // Generate the final report
    return Array.from(reportMap.entries()).map(([supplierName, data]) => {
      const balance = data.totalPaid - data.totalPurchases;
      let balanceType: 'debtor' | 'creditor' | 'balanced' = 'balanced';
      if (balance > 0) {
        balanceType = 'creditor'; // We have paid more than we purchased (credit with supplier)
      } else if (balance < 0) {
        balanceType = 'debtor'; // We owe the supplier money
      }

      return {
        supplierName,
        totalPurchases: data.totalPurchases,
        totalPaid: data.totalPaid,
        balance: balance,
        balanceType: balanceType,
      };
    }).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }, [transactions, supplierPayments]);

  const totalCreditorAmount = suppliersReport.filter(s => s.balanceType === 'creditor').reduce((sum, s) => sum + s.balance, 0);
  const totalDebtorAmount = suppliersReport.filter(s => s.balanceType === 'debtor').reduce((sum, s) => sum + s.balance, 0);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Users className="h-8 w-8" />
          تقرير الموردين
        </h1>
      </header>
      
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي عدد الموردين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliersReport.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأرصدة الدائنة (لنا)</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalCreditorAmount.toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأرصدة المدينة (علينا)</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{Math.abs(totalDebtorAmount).toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
      </div>


      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>ملخص أرصدة الموردين</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المورد</TableHead>
                  <TableHead className="text-center">إجمالي المشتريات</TableHead>
                  <TableHead className="text-center">إجمالي المدفوع</TableHead>
                  <TableHead className="text-center">الرصيد</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliersReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      لا توجد بيانات موردين لعرضها
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliersReport.map((report) => (
                    <TableRow key={report.supplierName}>
                      <TableCell className="font-medium">
                          {report.supplierName}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-semibold">
                        {report.totalPurchases.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">
                        {report.totalPaid.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className={`text-center font-bold ${
                        report.balance > 0 ? 'text-green-700' : 
                        report.balance < 0 ? 'text-red-700' : 'text-gray-700'
                      }`}>
                        {Math.abs(report.balance).toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={
                          report.balanceType === 'creditor' ? 'default' :
                          report.balanceType === 'debtor' ? 'destructive' : 'secondary'
                        }>
                          {report.balanceType === 'creditor' ? 'دائن (لنا)' :
                           report.balanceType === 'debtor' ? 'مدين (علينا)' : 'متوازن'}
                        </Badge>
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
