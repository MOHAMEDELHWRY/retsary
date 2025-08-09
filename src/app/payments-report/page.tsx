
"use client";

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Landmark,
  Calendar as CalendarIcon,
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  FileText,
  Eye,
} from 'lucide-react';

import { type SupplierPayment } from '@/types';
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

const paymentSchema = z.object({
  date: z.date({ required_error: "التاريخ مطلوب." }),
  fromEntity: z.string().min(1, "يجب تحديد الطرف الدافع."),
  toEntity: z.string().min(1, "يجب تحديد الطرف المستلم."),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر."),
  method: z.enum(['نقدي', 'بنكي'], { required_error: "طريقة الدفع مطلوبة." }),
  classification: z.enum(['دفعة من رصيد المبيعات', 'سحب أرباح للمورد', 'سداد للمصنع عن المورد', 'استعادة مبلغ كتسوية', 'سحب مبلغ كتسوية'], { required_error: "تصنيف الدفعة مطلوب." }),
  reason: z.string().min(1, "سبب الدفعة مطلوب."),
  responsiblePerson: z.string().min(1, "اسم المسؤول مطلوب."),
  sourceBank: z.string().optional(),
  destinationBank: z.string().optional(),
}).refine(data => data.fromEntity !== data.toEntity, {
    message: "لا يمكن أن يكون الدافع والمستلم نفس الشخص.",
    path: ["toEntity"],
});


type PaymentFormValues = z.infer<typeof paymentSchema>;

export default function PaymentsReportPage() {
  const { supplierPayments, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment, supplierNames, customerNames, loading } = useTransactions();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassification, setFilterClassification] = useState('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const allEntities = useMemo(() => {
    return Array.from(new Set([...supplierNames, ...customerNames])).sort();
  }, [supplierNames, customerNames]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      date: new Date(),
      fromEntity: '',
      toEntity: '',
      amount: 0,
      method: 'نقدي',
      classification: 'دفعة من رصيد المبيعات',
      reason: '',
      responsiblePerson: '',
      sourceBank: '',
      destinationBank: ''
    },
  });

  const handleOpenDialog = (payment: SupplierPayment | null) => {
    setEditingPayment(payment);
    setDocumentFile(null);
    if (payment) {
      form.reset({
        ...payment,
        date: new Date(payment.date),
      });
    } else {
      form.reset({
        date: new Date(),
        fromEntity: '',
        toEntity: '',
        amount: 0,
        method: 'نقدي',
        classification: 'دفعة من رصيد المبيعات',
        reason: '',
        responsiblePerson: '',
        sourceBank: '',
        destinationBank: ''
      });
    }
    setIsDialogOpen(true);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast({ title: "خطأ", description: "حجم الملف كبير جداً. الحد الأقصى 5 ميجا.", variant: "destructive" });
        return;
      }
      setDocumentFile(file);
    }
  };

  const onSubmit = async (values: PaymentFormValues) => {
    setIsSubmitting(true);
    try {
      if (editingPayment) {
        await updateSupplierPayment(editingPayment, values, documentFile);
        toast({ title: "نجاح", description: "تم تعديل الدفعة بنجاح." });
      } else {
        await addSupplierPayment(values, documentFile);
        toast({ title: "نجاح", description: "تمت إضافة الدفعة بنجاح." });
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Error submitting payment: ", error);
      toast({ title: "خطأ", description: error.message || "لم نتمكن من حفظ الدفعة.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (payment: SupplierPayment) => {
    await deleteSupplierPayment(payment);
  };

  const filteredPayments = useMemo(() => {
    return supplierPayments.filter(p => {
      const searchMatch =
        (p.fromEntity || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.toEntity || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.responsiblePerson || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const classificationMatch = filterClassification === 'all' || p.classification === filterClassification;

      return searchMatch && classificationMatch;
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
  }, [supplierPayments, searchTerm, filterClassification]);

  const classificationOptions: SupplierPayment['classification'][] = ['دفعة من رصيد المبيعات', 'سحب أرباح للمورد', 'سداد للمصنع عن المورد', 'استعادة مبلغ كتسوية', 'سحب مبلغ كتسوية'];

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
          <Landmark className="h-8 w-8" />
          سجل المدفوعات
        </h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة دفعة
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>سجل الدفعات</CardTitle>
          <CardDescription>عرض وإدارة جميع الدفعات والتحويلات المالية.</CardDescription>
            <div className="flex flex-col md:flex-row gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث باسم الدافع، المستلم، السبب أو المسؤول..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Select value={filterClassification} onValueChange={setFilterClassification}>
                <SelectTrigger className="w-full md:w-[250px]">
                  <SelectValue placeholder="فلترة حسب التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {classificationOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>من (الدافع)</TableHead>
                  <TableHead>إلى (المستلم)</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الطريقة</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>المسؤول</TableHead>
                  <TableHead>المستند</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      لا توجد دفعات مسجلة.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{format(payment.date, 'yyyy-MM-dd')}</TableCell>
                      <TableCell className="font-medium">{payment.fromEntity}</TableCell>
                      <TableCell className="font-medium">{payment.toEntity}</TableCell>
                      <TableCell className="font-bold text-primary">{payment.amount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell>{payment.classification}</TableCell>
                      <TableCell className="max-w-xs truncate">{payment.reason}</TableCell>
                      <TableCell>{payment.responsiblePerson}</TableCell>
                      <TableCell>
                        {payment.documentUrl ? (
                          <Button asChild variant="link" size="sm">
                            <a href={payment.documentUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4 mr-1" />
                              عرض
                            </a>
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(payment)}>
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
                                  سيتم حذف هذه الدفعة نهائياً. لا يمكن التراجع عن هذا الإجراء.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(payment)}>
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
            <DialogTitle>{editingPayment ? 'تعديل دفعة' : 'إضافة دفعة جديدة'}</DialogTitle>
            <DialogDescription>
              {editingPayment ? 'قم بتحديث معلومات الدفعة.' : 'أدخل معلومات الدفعة الجديدة.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>تاريخ الدفعة</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}
                                >
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
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
                  name="fromEntity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>من (الدافع)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر الدافع" /></SelectTrigger></FormControl>
                        <SelectContent>{allEntities.map(name => <SelectItem key={`from-${name}`} value={name}>{name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="toEntity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>إلى (المستلم)</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر المستلم" /></SelectTrigger></FormControl>
                        <SelectContent>{allEntities.map(name => <SelectItem key={`to-${name}`} value={name}>{name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>طريقة الدفع</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر الطريقة" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="نقدي">نقدي</SelectItem>
                          <SelectItem value="بنكي">بنكي</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="classification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>تصنيف الدفعة</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {classificationOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                />
              </div>
              
              {form.watch('method') === 'بنكي' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="sourceBank" render={({ field }) => (<FormItem><FormLabel>من بنك (اختياري)</FormLabel><FormControl><Input placeholder="اسم البنك المصدر" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="destinationBank" render={({ field }) => (<FormItem><FormLabel>إلى بنك (اختياري)</FormLabel><FormControl><Input placeholder="اسم البنك المستقبل" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              )}
               <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السبب / البيان</FormLabel>
                      <FormControl><Textarea placeholder="اكتب سبب الدفعة..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="responsiblePerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المسؤول عن الدفع</FormLabel>
                      <FormControl><Input placeholder="اسم الشخص المسؤول" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>مستند الدفع (اختياري)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                        <Input id="document-file" type="file" onChange={handleFileChange} accept="image/*,.pdf" className="flex-1" />
                        <label htmlFor="document-file">
                          <Button type="button" variant="outline" asChild>
                            <span><Upload className="h-4 w-4 mr-2" />رفع مستند</span>
                          </Button>
                        </label>
                    </div>
                  </FormControl>
                  {(documentFile || editingPayment?.documentUrl) && (
                    <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{documentFile?.name || editingPayment?.documentUrl?.split('%2F').pop()?.split('?')[0]}</span>
                        {(!!documentFile) && <Button type="button" size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0" onClick={() => setDocumentFile(null)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>


              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">إلغاء</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'جاري الحفظ...' : (editingPayment ? 'حفظ التعديلات' : 'إضافة الدفعة')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
