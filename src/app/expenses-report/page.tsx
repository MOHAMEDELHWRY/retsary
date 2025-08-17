"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  DollarSign,
  Download,
  Pencil,
  Plus,
  Search,
  Wallet,
  Trash2,
  Calendar as CalendarIcon,
  MinusCircle,
} from 'lucide-react';

import { type Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { cn, formatEGP } from '@/lib/utils';
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

const expenseSchema = z.object({
  date: z.date({ required_error: "التاريخ مطلوب." }),
  description: z.string().trim().min(1, "الوصف مطلوب."),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون صفرًا أو أكبر."),
  paymentOrder: z.string().optional(),
  supplierName: z.string().optional(),
  customerName: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

export default function ExpensesReportPage() {
  const { expenses, addExpense, updateExpense, deleteExpense, supplierNames, customerNames, loading } = useTransactions();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [isExpenseDatePopoverOpen, setIsExpenseDatePopoverOpen] = useState(false);

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: new Date(), description: "", amount: 0, paymentOrder: "", supplierName: "", customerName: "" },
  });
  
  const handleOpenExpenseDialog = (expense: Expense | null) => {
    setEditingExpense(expense);
    if (expense) {
      expenseForm.reset({ ...expense, date: new Date(expense.date) });
    } else {
      expenseForm.reset({ date: new Date(), description: "", amount: 0, paymentOrder: "", supplierName: "", customerName: "" });
    }
    setIsExpenseDialogOpen(true);
  };
  
  const onExpenseDialogOpenChange = (open: boolean) => {
    if (!open) setEditingExpense(null);
    setIsExpenseDialogOpen(open);
  };
  
  const onSubmitExpense = async (values: ExpenseFormValues) => {
    setIsExpenseSubmitting(true);
    try {
      if (editingExpense) {
        await updateExpense({ ...editingExpense, ...values });
        toast({ title: "نجاح", description: "تم تعديل المصروف بنجاح." });
      } else {
        await addExpense(values);
        toast({ title: "نجاح", description: "تمت إضافة المصروف بنجاح." });
      }
      expenseForm.reset();
      setIsExpenseDialogOpen(false);
    } catch(error) {
      console.error("Error submitting expense: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حفظ المصروف.", variant: "destructive" });
    } finally {
      setIsExpenseSubmitting(false);
    }
  };
  
  const handleDeleteExpense = async (expenseId: string) => await deleteExpense(expenseId);
  
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const searchMatch = 
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.supplierName && e.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.customerName && e.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.paymentOrder && e.paymentOrder.toLowerCase().includes(searchTerm.toLowerCase()));
      
      let dateMatch = true;
      if (startDate && endDate) {
        dateMatch = e.date >= startDate && e.date <= endDate;
      } else if (startDate) {
        dateMatch = e.date >= startDate;
      } else if (endDate) {
        dateMatch = e.date <= endDate;
      }
      return searchMatch && dateMatch;
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
  }, [expenses, searchTerm, startDate, endDate]);

  const totalExpenses = useMemo(() => filteredExpenses.reduce((acc, e) => acc + e.amount, 0), [filteredExpenses]);

  const handleExport = () => {
    const headers = ["التاريخ", "الوصف", "المورد", "العميل", "أمر الصرف", "المبلغ"];
    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return "";
      const string = String(str);
      if (string.search(/("|,|\n)/g) >= 0) return `"${string.replace(/"/g, '""')}"`;
      return string;
    };
    const rows = filteredExpenses.map(e => [
      format(e.date, 'yyyy-MM-dd'),
      escapeCSV(e.description),
      escapeCSV(e.supplierName),
      escapeCSV(e.customerName),
      escapeCSV(e.paymentOrder),
      e.amount
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "expenses.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 animate-pulse">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-primary">تقرير المصروفات</h1>
          <Skeleton className="h-10 w-24" />
        </header>
        <Card>
          <CardHeader> <Skeleton className="h-6 w-1/4 rounded" /> <div className="flex flex-col md:flex-row gap-2 mt-4"> <Skeleton className="h-10 flex-1 rounded" /> <Skeleton className="h-10 w-60 rounded" /> </div> </CardHeader>
          <CardContent> <div className="space-y-2"> <Skeleton className="h-12 w-full rounded" /> <Skeleton className="h-12 w-full rounded" /> <Skeleton className="h-12 w-full rounded" /> <Skeleton className="h-12 w-full rounded" /> </div> </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary">تقرير المصروفات</h1>
        <div className="flex gap-2">
            <Button onClick={() => handleOpenExpenseDialog(null)}><Plus className="ml-2 h-4 w-4" /> إضافة مصروف</Button>
            <Button variant="outline" onClick={handleExport}><Download className="ml-2 h-4 w-4" /> تصدير CSV</Button>
        </div>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>ملخص المصروفات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-destructive">
            {formatEGP(totalExpenses)}
          </div>
          <p className="text-sm text-muted-foreground">
            إجمالي المصروفات للفترة المحددة
          </p>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>سجل المصروفات</CardTitle>
              <div className="flex flex-col md:flex-row gap-2 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="بحث بالوصف، المورد، العميل أو أمر الصرف..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
              <div className="relative w-full overflow-auto">
                  <Table className="[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                      <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الوصف</TableHead><TableHead>المورد</TableHead><TableHead>العميل</TableHead><TableHead>أمر الصرف</TableHead><TableHead>المبلغ</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredExpenses.length > 0 ? (filteredExpenses.map(e => (
                          <TableRow key={e.id}>
                            <TableCell>{format(e.date, 'yyyy-MM-dd')}</TableCell>
                            <TableCell>{e.description}</TableCell>
                            <TableCell>{e.supplierName || '-'}</TableCell>
                            <TableCell>{e.customerName || '-'}</TableCell>
                            <TableCell>{e.paymentOrder || '-'}</TableCell>
                            <TableCell className="text-destructive font-medium">{formatEGP(e.amount)}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenExpenseDialog(e)}><Pencil className="h-4 w-4" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle><AlertDialogDescription>هذا الإجراء سيحذف المصروف بشكل دائم ولا يمكن التراجع عنه.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteExpense(e.id)}>متابعة</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))) : (
                          <TableRow><TableCell colSpan={7} className="h-24 text-center">لا توجد مصروفات للفترة المحددة.</TableCell></TableRow>
                        )}
                      </TableBody>
                  </Table>
              </div>
          </CardContent>
          <CardFooter>
            <div className="text-xs text-muted-foreground">
              يتم عرض <strong>{filteredExpenses.length}</strong> من إجمالي <strong>{expenses.length}</strong> مصروف.
            </div>
          </CardFooter>
      </Card>
      
      <Dialog open={isExpenseDialogOpen} onOpenChange={onExpenseDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}</DialogTitle>
            <DialogDescription>
              {editingExpense ? 'قم بتعديل بيانات المصروف أدناه' : 'أدخل بيانات المصروف الجديد أدناه'}
            </DialogDescription>
          </DialogHeader>
          <Form {...expenseForm}>
            <form onSubmit={expenseForm.handleSubmit(onSubmitExpense)} className="grid gap-4 py-4">
              <FormField control={expenseForm.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>تاريخ المصروف</FormLabel><Popover modal={false} open={isExpenseDatePopoverOpen} onOpenChange={setIsExpenseDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsExpenseDatePopoverOpen(false); }} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
              )} />
              <FormField control={expenseForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>الوصف / سبب الصرف</FormLabel><FormControl><Input placeholder="مثال: سحب أرباح" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={expenseForm.control} name="paymentOrder" render={({ field }) => (
                <FormItem><FormLabel>أمر الصرف (اختياري)</FormLabel><FormControl><Input placeholder="رقم أمر الصرف" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={expenseForm.control} name="supplierName" render={({ field }) => (
                <FormItem><FormLabel>خصم من ربح المورد (اختياري)</FormLabel><Select onValueChange={(value) => field.onChange(value === '__general__' ? '' : value)} value={field.value || '__general__'}><FormControl><SelectTrigger><SelectValue placeholder="اختر موردًا" /></SelectTrigger></FormControl><SelectContent><SelectItem value="__general__">مصروف عام (لا يوجد مورد)</SelectItem>{supplierNames.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={expenseForm.control} name="customerName" render={({ field }) => (
                <FormItem><FormLabel>خصم من ربح العميل (اختياري)</FormLabel><Select onValueChange={(value) => field.onChange(value === '__general__' ? '' : value)} value={field.value || '__general__'}><FormControl><SelectTrigger><SelectValue placeholder="اختر عميلاً" /></SelectTrigger></FormControl><SelectContent><SelectItem value="__general__">مصروف عام (لا يوجد عميل)</SelectItem>{customerNames.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={expenseForm.control} name="amount" render={({ field }) => (
                <FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">إلغاء</Button></DialogClose>
                <Button type="submit" disabled={isExpenseSubmitting}>{isExpenseSubmitting ? 'جاري الحفظ...' : (editingExpense ? 'حفظ التعديلات' : 'حفظ المصروف')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
