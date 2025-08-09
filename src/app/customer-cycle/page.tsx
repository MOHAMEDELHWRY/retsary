
"use client";

import { useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CustomerReport {
  customerName: string;
  totalSales: number;
  totalPayments: number;
  balance: number;
  balanceType: 'creditor' | 'debtor' | 'balanced';
}

export default function CustomerCyclePage() {
  const { customerNames, getCustomerBalance } = useTransactions();

  const customersReport = useMemo<CustomerReport[]>(() => {
    return customerNames.map(name => {
      const balanceData = getCustomerBalance(name);
      return {
        customerName: name,
        totalSales: balanceData.totalSales,
        totalPayments: balanceData.totalPayments,
        balance: balanceData.balance,
        balanceType: balanceData.balance > 0 ? 'debtor' : balanceData.balance < 0 ? 'creditor' : 'balanced',
      };
    }).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [customerNames, getCustomerBalance]);

  const totalCreditorAmount = customersReport
    .filter(c => c.balanceType === 'creditor')
    .reduce((sum, c) => sum + Math.abs(c.balance), 0);
  
  const totalDebtorAmount = customersReport
    .filter(c => c.balanceType === 'debtor')
    .reduce((sum, c) => sum + c.balance, 0);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Users2 className="h-8 w-8" />
          ملخص العملاء
        </h1>
      </header>
      
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي عدد العملاء</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersReport.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأرصدة الدائنة (لهم)</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalCreditorAmount.toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأرصدة المدينة (عليهم)</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalDebtorAmount.toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
      </div>


      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>ملخص أرصدة العملاء</CardTitle>
          <CardDescription>عرض لجميع العملاء وأرصدتهم الحالية.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم العميل</TableHead>
                  <TableHead className="text-center">إجمالي المبيعات</TableHead>
                  <TableHead className="text-center">إجمالي المدفوع</TableHead>
                  <TableHead className="text-center">الرصيد</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center">تفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      لا يوجد عملاء لعرضهم
                    </TableCell>
                  </TableRow>
                ) : (
                  customersReport.map((report) => (
                    <TableRow key={report.customerName}>
                      <TableCell className="font-medium">
                        {report.customerName}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-semibold">
                        {report.totalSales.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">
                        {report.totalPayments.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className={`text-center font-bold ${
                        report.balance > 0 ? 'text-red-700' : 
                        report.balance < 0 ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        {Math.abs(report.balance).toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={
                          report.balanceType === 'debtor' ? 'destructive' :
                          report.balanceType === 'creditor' ? 'default' : 'secondary'
                        }>
                          {report.balanceType === 'debtor' ? 'مدين (عليه)' :
                           report.balanceType === 'creditor' ? 'دائن (له)' : 'متوازن'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/customer-sales?customer=${encodeURIComponent(report.customerName)}`}>
                            عرض التفاصيل
                          </Link>
                        </Button>
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
