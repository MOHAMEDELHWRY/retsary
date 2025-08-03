"use client";

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTransactions } from '@/context/transactions-context';
import { useToast } from '@/hooks/use-toast';
import { type Supplier } from '@/types';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Phone,
  User,
  MapPin,
  FileText
} from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

const supplierSchema = z.object({
  name: z.string().trim().min(1, "اسم المورد مطلوب."),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export default function SuppliersLogPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, loading } = useTransactions();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", contactPerson: "", phone: "", address: "", notes: "" },
  });

  const handleOpenDialog = (supplier: Supplier | null = null) => {
    setEditingSupplier(supplier);
    if (supplier) {
      form.reset(supplier);
    } else {
      form.reset({ name: "", contactPerson: "", phone: "", address: "", notes: "" });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: SupplierFormValues) => {
    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await updateSupplier({ ...editingSupplier, ...values });
        toast({ title: "تم التحديث", description: "تم تحديث بيانات المورد بنجاح." });
      } else {
        await addSupplier(values);
        toast({ title: "تمت الإضافة", description: "تم إضافة المورد بنجاح." });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error submitting supplier:", error);
      toast({ title: "خطأ", description: "لم نتمكن من حفظ بيانات المورد.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (supplierId: string) => {
    try {
      await deleteSupplier(supplierId);
      toast({ title: "تم الحذف", description: "تم حذف المورد بنجاح." });
    } catch (error) {
       console.error("Error deleting supplier:", error);
       toast({ title: "خطأ", description: "لم نتمكن من حذف المورد.", variant: "destructive" });
    }
  };

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 animate-pulse">
        <header className="flex items-center justify-between mb-8">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-32" />
        </header>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Users className="h-8 w-8" />
          سجل الموردين
        </h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة مورد جديد
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>قائمة الموردين</CardTitle>
          <CardDescription>عرض وإدارة جميع الموردين المسجلين في النظام.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المورد</TableHead>
                  <TableHead>المسؤول</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      لا يوجد موردين مسجلين. ابدأ بإضافة مورد جديد.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.contactPerson || '-'}</TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>{supplier.address || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{supplier.notes || '-'}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(supplier)}>
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
                                  سيتم حذف هذا المورد نهائياً. لا يمكن التراجع عن هذا الإجراء.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(supplier.id)}>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? 'قم بتحديث معلومات المورد أدناه.' : 'أدخل معلومات المورد الجديد.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المورد</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="اسم الشركة أو الشخص" {...field} className="pr-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المسؤول (اختياري)</FormLabel>
                    <FormControl>
                     <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="اسم الشخص المسؤول" {...field} className="pr-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الهاتف (اختياري)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="01xxxxxxxxx" {...field} className="pr-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>العنوان (اختياري)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="عنوان المورد" {...field} className="pr-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="أي ملاحظات إضافية عن المورد..." {...field} />
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
                  {isSubmitting ? 'جاري الحفظ...' : (editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
