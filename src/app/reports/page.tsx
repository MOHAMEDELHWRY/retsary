"use client";

import React, { useState, useMemo } from 'react';
import { useTransactions } from '@/context/transactions-context';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  DollarSign,
  TrendingUp,
  Search,
  Users,
  Factory,
  Calendar as CalendarIcon,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function ReportsPage() {
  const { transactions, customerNames, supplierNames } = useTransactions();
  const [filters, setFilters] = useState({
    searchTerm: '',
    customer: 'all',
    supplier: 'all',
    startDate: null as Date | null,
    endDate: null as Date | null,
  });

  const salesTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.totalSellingPrice > 0)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions]);

  const filteredSales = useMemo(() => {
    return salesTransactions.filter((t) => {
      const { searchTerm, customer, supplier, startDate, endDate } = filters;
      const lowercasedSearch = searchTerm.toLowerCase();

      const searchMatch =
        searchTerm === '' ||
        t.description.toLowerCase().includes(lowercasedSearch) ||
        t.supplierName.toLowerCase().includes(lowercasedSearch) ||
        (t.operationNumber &&
          t.operationNumber.toLowerCase().includes(lowercasedSearch)) ||
        (t.customerName && t.customerName.toLowerCase().includes(lowercasedSearch));

      const customerMatch = customer === 'all' || t.customerName === customer;
      const supplierMatch = supplier === 'all' || t.supplierName === supplier;

      let dateMatch = true;
      if (startDate && endDate) {
        dateMatch =
          t.date >= startDate &&
          t.date <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1); // include the whole end day
      } else if (startDate) {
        dateMatch = t.date >= startDate;
      } else if (endDate) {
        dateMatch = t.date <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
      }

      return searchMatch && customerMatch && supplierMatch && dateMatch;
    });
  }, [salesTransactions, filters]);

  const summary = useMemo(() => {
    const totalSales = filteredSales.reduce(
      (sum, t) => sum + t.totalSellingPrice,
      0
    );
    const totalProfit = filteredSales.reduce((sum, t) => sum + t.profit, 0);
    const numberOfSales = filteredSales.length;
    const averageProfit = numberOfSales > 0 ? totalProfit / numberOfSales : 0;

    return {
      totalSales,
      totalProfit,
      numberOfSales,
      averageProfit,
    };
  }, [filteredSales]);
  
  const monthlyProfitData = useMemo(() => {
    const data: { [key: string]: { profit: number; sales: number } } = {};
    filteredSales.forEach(t => {
      const monthKey = format(t.date, 'yyyy-MM');
      if (!data[monthKey]) {
        data[monthKey] = { profit: 0, sales: 0 };
      }
      data[monthKey].profit += t.profit;
      data[monthKey].sales += t.totalSellingPrice;
    });

    return Object.entries(data)
      .map(([monthKey, values]) => ({
        monthKey,
        name: format(new Date(`${monthKey}-01`), 'MMM yy', { locale: ar }),
        'الأرباح': values.profit,
        'المبيعات': values.sales,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredSales]);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  
  const clearFilters = () => {
    setFilters({
        searchTerm: '',
        customer: 'all',
        supplier: 'all',
        startDate: null,
        endDate: null,
    });
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <LineChart className="h-8 w-8" />
          تقارير المبيعات والأرباح
        </h1>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {summary.totalSales.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأرباح</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.totalProfit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط الربح / عملية</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.averageProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.averageProfit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Chart */}
       <Card className="mb-8">
        <CardHeader>
          <CardTitle>ملخص الأرباح الشهري</CardTitle>
          <CardDescription>عرض بياني للأرباح والمبيعات على مدار الأشهر</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyProfitData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `ج.م ${value.toLocaleString()}`} />
              <Tooltip formatter={(value: number, name: string) => [value.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }), name]} />
              <Legend />
              <Bar dataKey="المبيعات" fill="#3D5A80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="الأرباح" fill="#98C1D9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>سجل المبيعات المفصل</CardTitle>
          <div className="mt-4 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في المبيعات..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={filters.customer} onValueChange={(v) => handleFilterChange('customer', v)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <Users className="h-4 w-4 text-muted-foreground mr-2" />
                        <SelectValue placeholder="فلترة بالعميل" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل العملاء</SelectItem>
                        {customerNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.supplier} onValueChange={(v) => handleFilterChange('supplier', v)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <Factory className="h-4 w-4 text-muted-foreground mr-2" />
                        <SelectValue placeholder="فلترة بالمورد" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الموردين</SelectItem>
                        {supplierNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !filters.startDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.startDate ? format(filters.startDate, "dd/MM/yyyy") : <span>من تاريخ</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filters.startDate ?? undefined} onSelect={(d) => handleFilterChange('startDate', d)} initialFocus /></PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !filters.endDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.endDate ? format(filters.endDate, "dd/MM/yyyy") : <span>إلى تاريخ</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filters.endDate ?? undefined} onSelect={(d) => handleFilterChange('endDate', d)} initialFocus /></PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="icon" onClick={clearFilters} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></Button>
                </div>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead className="text-center">إجمالي البيع</TableHead>
                  <TableHead className="text-center">إجمالي الشراء</TableHead>
                  <TableHead className="text-center">الربح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      لا توجد مبيعات تطابق معايير البحث
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {format(t.date, 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell className="font-medium">{t.customerName}</TableCell>
                      <TableCell>{t.supplierName}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell className="text-center font-semibold text-blue-600">
                        {t.totalSellingPrice.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                      </TableCell>
                       <TableCell className="text-center font-semibold text-orange-600">
                        {t.totalPurchasePrice.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                      </TableCell>
                      <TableCell className={`text-center font-bold ${t.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.profit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
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
