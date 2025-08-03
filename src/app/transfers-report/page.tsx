"use client";

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Plus,
  Search,
  Pencil,
  Trash2,
} from 'lucide-react';

import { type BalanceTransfer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useTransactions } from '@/context/transactions-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

const transferSchema = z.object({
  date: z.date({ required_error: "التاريخ مطلوب." }),
  fromSupplier: z.string().min(1, "يجب تحديد المورد المحول منه."),
  toSupplier: z.string().min(1, "يجب تحديد المورد المحول إليه."),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر."),
  fromAccount: z.enum(['sales_balance', 'factory_balance', 'profit_expense']),
  toAccount: z.enum(['sales_balance', 'factory_balance']),
  reason: z.string().min(1, "يجب كتابة سبب التحويل."),
}).refine(data => data.fromSupplier !== data.toSupplier, {
  message: "لا يمكن التحويل إلى نفس المورد.",
  path: ["toSupplier"],
});

type TransferFormValues = z.infer<typeof transferSchema>;

export default function TransfersReportPage() {
  const { balanceTransfers, addBalanceTransfer, updateBalanceTransfer, deleteBalanceTransfer, supplierNames, loading } = useTransactions();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<BalanceTransfer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      date: new Date(),
      fromSupplier: '',
      toSupplier: '',
      amount: 0,
      fromAccount: 'sales_balance',
      toAccount: 'sales_balance',
      reason: '',
    },
  });

  const handleOpenDialog = (transfer: BalanceTransfer | null) => {
    setEditingTransfer(transfer);
    if (transfer) {
      form.reset({
        ...transfer,
        date: new Date(transfer.date),
      });
    } else {
      form.reset({
        date: new Date(),
        fromSupplier: '',
        toSupplier: '',
        amount: 0,
        fromAccount: 'sales_balance',
        toAccount: 'sales_balance',
        reason: '',
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: TransferFormValues) => {
    setIsSubmitting(true);
    try {
      if (editingTransfer) {
        await updateBalanceTransfer({ ...editingTransfer, ...values });
        toast({ title: "نجاح", description: "تم تعديل التحويل بنجاح." });
      } else {
        await addBalanceTransfer(values);
        toast({ title: "نجاح", description: "تمت إضافة التحويل بنجاح." });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error submitting transfer: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حفظ التحويل.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (transferId: string) => {
    await deleteBalanceTransfer(transferId);
  };

  const filteredTransfers = useMemo(() => {
    return balanceTransfers.filter(t => {
      const searchMatch =
        t.fromSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.toSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.reason.toLowerCase().includes(searchTerm.toLowerCase());
      
      let dateMatch = true;
      if (startDate && endDate) {
        dateMatch = t.date >= startDate && t.date <= endDate;
      } else if (startDate) {
        dateMatch = t.date >= startDate;
      } else if (endDate) {
        dateMatch = t.date <= endDate;
      }

      return searchMatch && dateMatch;
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
  }, [balanceTransfers, searchTerm, startDate, endDate]);

  const accountTranslations: { [key: string]: string } = {
    sales_balance: 'رصيد مبيعات',
    factory_balance: 'رصيد مصنع',
    profit_expense: 'ربح/مصروف',
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 animate-pulse">
        <header className="flex items-center justify-between mb-8">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-32" />
        </header>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
          <CardContent><div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <ArrowRightLeft className="h-8 w-8" />
          تقرير التحويلات
        </h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة تحويل
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>سجل التحويلات بين الأرصدة</CardTitle>
          <CardDescription>عرض وإدارة جميع عمليات تحويل الأرصدة بين الموردين.</CardDescription>
            <div className="flex flex-col md:flex-row gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث باسم المورد أو السبب..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <div className="flex flex-col md:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full md:w-[280px] justify-start text-right font-normal", !(startDate || endDate) && "text-muted-foreground")}>
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {startDate && endDate ? `${format(startDate, "LLL dd, y")} - ${format(endDate, "LLL dd, y")}` : <span>اختر نطاق تاريخ</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={startDate}
                      selected={{ from: startDate, to: endDate }}
                      onSelect={(range) => {
                        setStartDate(range?.from);
                        setEndDate(range?.to);
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                {(startDate || endDate) && (<Button variant="ghost" onClick={() => {setStartDate(undefined); setEndDate(undefined);}} className="text-destructive">مسح الفلتر</Button>)}
              </div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>من المورد</TableHead>
                  <TableHead>إلى المورد</TableHead>
                  <TableHead>من حساب</TableHead>
                  <TableHead>إلى حساب</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      لا توجد تحويلات مسجلة.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>{format(transfer.date, 'yyyy-MM-dd')}</TableCell>
                      <TableCell className="font-medium">{transfer.fromSupplier}</TableCell>
                      <TableCell className="font-medium">{transfer.toSupplier}</TableCell>
                      <TableCell>{accountTranslations[transfer.fromAccount] || transfer.fromAccount}</TableCell>
                      <TableCell>{accountTranslations[transfer.toAccount] || transfer.toAccount}</TableCell>
                      <TableCell className="font-bold text-primary">{transfer.amount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell className="max-w-xs truncate">{transfer.reason}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(transfer)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذا التحويل نهائياً. لا يمكن التراجع عن هذا الإجراء.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(transfer.id)}>
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTransfer ? 'تعديل تحويل' : 'إضافة تحويل جديد'}</DialogTitle>
            <DialogDescription>
              {editingTransfer ? 'قم بتحديث معلومات التحويل.' : 'أدخل معلومات التحويل الجديد.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>تاريخ التحويل</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-right font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date()}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المبلغ</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromSupplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>من المورد</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر المورد المحول منه" /></SelectTrigger></FormControl>
                        <SelectContent>{supplierNames.map(name => <SelectItem key={`from-${name}`} value={name}>{name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fromAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>من حساب</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="sales_balance">{accountTranslations.sales_balance}</SelectItem>
                          <SelectItem value="factory_balance">{accountTranslations.factory_balance}</SelectItem>
                          <SelectItem value="profit_expense">{accountTranslations.profit_expense}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="toSupplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>إلى المورد</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر المورد المحول إليه" /></SelectTrigger></FormControl>
                        <SelectContent>{supplierNames.map(name => <SelectItem key={`to-${name}`} value={name}>{name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="toAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>إلى حساب</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="sales_balance">{accountTranslations.sales_balance}</SelectItem>
                          <SelectItem value="factory_balance">{accountTranslations.factory_balance}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السبب</FormLabel>
                      <FormControl>
                        <Textarea placeholder="اكتب سبب التحويل..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">إلغاء</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الحفظ...' : (editingTransfer ? 'حفظ التعديلات' : 'إضافة التحويل')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
