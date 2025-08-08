
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import {
  DollarSign,
  Download,
  Pencil,
  Plus,
  Search,
  LineChart,
  Calendar as CalendarIcon,
  ShoppingCart,
  Factory,
  MinusCircle,
  Wallet,
  Trash2,
  Edit2,
  Wand2,
  CreditCard,
  Package,
  Upload,
  FileText,
  Image,
  X,
  ChevronLeft,
  ChevronRight,
  Truck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

import { type Transaction, type Expense } from '@/types';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useTransactions } from '@/context/transactions-context';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { governorates, cities } from '@/data/egypt-governorates';
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
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { EditableDropdown } from '@/components/ui/editable-dropdown';
import { type PerformanceAnalysisOutput } from '@/ai/flows/analyze-performance-flow';
import { descriptionOptions, categoryOptions, varietyOptions } from '@/data/transaction-data';

const transactionSchema = z.object({
  operationNumber: z.string().optional(),
  customerName: z.string().optional(),
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  executionDate: z.date().optional(),
  showExecutionDate: z.boolean().optional().default(false),
  dueDate: z.date().optional(),
  supplierName: z.string().trim().min(1, 'اسم المورد مطلوب.'),
  governorate: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  variety: z.string().optional(),
  quantity: z.coerce.number().min(0, 'الكمية يجب أن تكون موجبة.').default(0),
  purchasePrice: z.coerce.number().min(0, 'سعر الشراء يجب أن يكون موجبًا.').default(0),
  sellingPrice: z.coerce.number().min(0, 'سعر البيع يجب أن يكون موجبًا.').default(0),
  taxes: z.coerce.number().min(0, 'الضرائب يجب أن تكون موجبة.').default(0),
  amountPaidToFactory: z.coerce.number().min(0, 'المبلغ المدفوع يجب أن يكون موجبًا.').default(0),
  paidBy: z.string().optional(), //  من قام بالدفع للمصنع
  amountReceivedFromSupplier: z.coerce.number().min(0, 'المبلغ المستلم يجب أن يكون موجبًا.').default(0),
  
  paymentMethodToFactory: z.enum(['نقدي', 'تحويل بنكي', 'إيداع']).optional(),
  paymentMethodFromSupplier: z.enum(['نقدي', 'تحويل بنكي', 'إيداع']).optional(),
  
  actualQuantityDeducted: z.coerce.number().min(0, 'الكمية الفعلية يجب أن تكون موجبة.').optional(),
  transactionDate: z.date().optional(),
  transactionNumber: z.string().optional(),

  carrierName: z.string().optional(),
  carrierPhone: z.string().optional(),
  departureDate: z.date().optional(),

  amountReceivedFromCustomer: z.coerce.number().min(0).optional(),
  dateReceivedFromCustomer: z.date().optional(),
  paymentMethodFromCustomer: z.enum(['نقدي', 'تحويل بنكي', 'إيداع', 'شيك']).optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function TransactionsLogPage() {
  const { 
    transactions, addTransaction, updateTransaction, deleteTransaction, 
    loading,
    createCustomerPaymentFromTransaction,
    supplierNames,
    customerNames
  } = useTransactions();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [dateType, setDateType] = useState<'operation' | 'execution'>('operation');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewAttachments, setPreviewAttachments] = useState<Transaction['attachments']>([]);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const [attachments, setAttachments] = useState<Array<{
    id: string;
    name: string;
    file: File;
    type: 'image' | 'pdf' | 'document';
    category: 'factory_payment' | 'supplier_receipt' | 'invoice' | 'other';
    preview?: string;
  }>>([]);
  
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isExecDatePopoverOpen, setIsExecDatePopoverOpen] = useState(false);
  const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = useState(false);
  const [isTransactionDatePopoverOpen, setIsTransactionDatePopoverOpen] = useState(false);
  const [isDepartureDatePopoverOpen, setIsDepartureDatePopoverOpen] = useState(false);
  const [isDateReceivedPopoverOpen, setIsDateReceivedPopoverOpen] = useState(false);
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);

  const setDateRangePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const today = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'week':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
        end = today;
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      case 'all':
        start = undefined;
        end = undefined;
        break;
    }
    setStartDate(start);
    setEndDate(end);
  };

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setDateType('operation');
  };
  
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { 
      operationNumber: "",
      customerName: "",
      date: new Date(), 
      executionDate: undefined, 
      dueDate: undefined, 
      supplierName: "", 
      governorate: "", 
      city: "", 
      description: "اسمنت العريش", 
      category: "", 
      variety: "", 
      quantity: 0, 
      purchasePrice: 0, 
      sellingPrice: 0, 
      taxes: 0, 
      amountPaidToFactory: 0, 
      paidBy: "",
      amountReceivedFromSupplier: 0, 
      showExecutionDate: false,
      paymentMethodToFactory: undefined,
      paymentMethodFromSupplier: undefined,
      actualQuantityDeducted: 0,
      transactionNumber: "",
      carrierName: "",
      carrierPhone: "",
      departureDate: undefined,
      amountReceivedFromCustomer: 0,
      dateReceivedFromCustomer: undefined,
      paymentMethodFromCustomer: undefined,
    },
  });
  const { watch, setValue } = form;
  const watchedValues = watch();
  const selectedGovernorate = watch("governorate");

  useEffect(() => {
      if (selectedGovernorate) {
          setAvailableCities(cities[selectedGovernorate] || []);
          setValue("city", "", { shouldValidate: false });
      } else {
          setAvailableCities([]);
      }
  }, [selectedGovernorate, setValue]);


  const handleOpenDialog = (transaction: Transaction | null) => {
    setEditingTransaction(transaction);
    if (transaction) {
      form.reset({
        ...transaction,
        operationNumber: transaction.operationNumber || '',
        customerName: transaction.customerName || '',
        paidBy: transaction.paidBy || '',
        date: new Date(transaction.date),
        executionDate: transaction.executionDate ? new Date(transaction.executionDate) : undefined,
        dueDate: transaction.dueDate ? new Date(transaction.dueDate) : undefined,
        transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate) : undefined,
        departureDate: transaction.departureDate ? new Date(transaction.departureDate) : undefined,
        showExecutionDate: transaction.showExecutionDate ?? false,
        governorate: transaction.governorate || '',
        city: transaction.city || '',
        description: transaction.description || '',
        category: transaction.category || '',
        variety: transaction.variety || '',
        paymentMethodToFactory: transaction.paymentMethodToFactory || undefined,
        paymentMethodFromSupplier: transaction.paymentMethodFromSupplier || undefined,
        actualQuantityDeducted: transaction.actualQuantityDeducted || 0,
        transactionNumber: transaction.transactionNumber || '',
        carrierName: transaction.carrierName || "",
        carrierPhone: transaction.carrierPhone || "",
        amountReceivedFromCustomer: transaction.amountReceivedFromCustomer || 0,
        dateReceivedFromCustomer: transaction.dateReceivedFromCustomer ? new Date(transaction.dateReceivedFromCustomer) : undefined,
        paymentMethodFromCustomer: transaction.paymentMethodFromCustomer || undefined,
      });
       if (transaction.governorate) setAvailableCities(cities[transaction.governorate] || []);
    } else {
      form.reset({ 
        operationNumber: "",
        customerName: "",
        date: new Date(), 
        executionDate: undefined, 
        dueDate: undefined, 
        transactionDate: undefined,
        supplierName: "", 
        governorate: "", 
        city: "", 
        description: "اسمنت العريش", 
        category: "", 
        variety: "", 
        quantity: 0, 
        purchasePrice: 0, 
        sellingPrice: 0, 
        taxes: 0, 
        amountPaidToFactory: 0, 
        paidBy: "",
        amountReceivedFromSupplier: 0, 
        showExecutionDate: false,
        paymentMethodToFactory: undefined,
        paymentMethodFromSupplier: undefined,
        actualQuantityDeducted: 0,
        transactionNumber: "",
        carrierName: "",
        carrierPhone: "",
        departureDate: undefined,
        amountReceivedFromCustomer: 0,
        dateReceivedFromCustomer: undefined,
        paymentMethodFromCustomer: undefined,
      });
    }
    setIsDialogOpen(true);
  };
  
  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      setEditingTransaction(null);
      setAttachments([]);
    }
    setIsDialogOpen(open);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, category: 'factory_payment' | 'supplier_receipt' | 'invoice' | 'other') => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const fileType = file.type;
      let type: 'image' | 'pdf' | 'document' = 'document';
      
      if (fileType.startsWith('image/')) type = 'image';
      else if (fileType === 'application/pdf') type = 'pdf';

      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "خطأ في الملف", description: `حجم الملف ${file.name} كبير جداً. يجب أن يكون أقل من 10MB.`, variant: "destructive" });
        return;
      }

      const newAttachment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        file,
        type,
        category,
        preview: type === 'image' ? URL.createObjectURL(file) : undefined
      };
      setAttachments(prev => [...prev, newAttachment]);
    });
    event.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
      return prev.filter(a => a.id !== id);
    });
  };

  const uploadAttachmentsToFirebase = async (transactionId: string) => {
    try {
      const uploadPromises = attachments.map(async (attachment) => {
        if (!attachment.file) return null;
        const fileName = `${Date.now()}_${attachment.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `transactions/${transactionId}/${fileName}`);
        const snapshot = await uploadBytes(storageRef, attachment.file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return { id: attachment.id, name: attachment.name, url: downloadURL, type: attachment.type, uploadDate: new Date(), category: attachment.category };
      });
      
      const uploadedAttachments = await Promise.all(uploadPromises);
      return uploadedAttachments.filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error) {
      console.error('خطأ في رفع المرفقات:', error);
      toast({ title: "خطأ في رفع المرفقات", description: "حدث خطأ أثناء رفع الملفات.", variant: "destructive" });
      throw error;
    }
  };

  const deleteAttachmentFromFirebase = async (attachmentUrl: string) => {
    try {
      let filePath = attachmentUrl;
      if (attachmentUrl.includes('firebasestorage.googleapis.com')) {
        const urlParts = attachmentUrl.split('/o/')[1];
        if (urlParts) filePath = decodeURIComponent(urlParts.split('?')[0]);
      }
      const attachmentRef = ref(storage, filePath);
      await deleteObject(attachmentRef);
      return true;
    } catch (error: any) {
      if (error?.code === 'storage/object-not-found') return true;
      return false;
    }
  };

  const handleDeleteExistingAttachment = async (attachmentId: string, attachmentUrl: string) => {
    const targetTransaction = editingTransaction || previewTransaction;
    if (!targetTransaction || !window.confirm('هل أنت متأكد من حذف هذا المرفق؟')) return;

    try {
      await deleteAttachmentFromFirebase(attachmentUrl);
      const updatedAttachments = targetTransaction.attachments?.filter(att => att.id !== attachmentId) || [];
      const updatedTransaction = { ...targetTransaction, attachments: updatedAttachments };
      await updateTransaction(updatedTransaction);

      if (editingTransaction) setEditingTransaction(updatedTransaction);
      if (previewTransaction) setPreviewTransaction(updatedTransaction);
      setPreviewAttachments(updatedAttachments);
      if (updatedAttachments.length === 0) setIsPreviewOpen(false);
      else if (currentPreviewIndex >= updatedAttachments.length) setCurrentPreviewIndex(updatedAttachments.length - 1);
      toast({ title: "تم حذف المرفق", description: "تم حذف المرفق بنجاح." });
    } catch (error) {
      toast({ title: "خطأ في الحذف", description: "حدث خطأ أثناء حذف المرفق.", variant: "destructive" });
    }
  };

  const handleReplaceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetTransaction = editingTransaction || previewTransaction;
    const currentAttachment = previewAttachments?.[currentPreviewIndex];
    if (!file || !targetTransaction || !currentAttachment) return;

    const fileType = file.type.startsWith('image/') ? 'image' : (file.type === 'application/pdf' ? 'pdf' : 'document');
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "خطأ في الملف", description: `حجم الملف كبير جداً.`, variant: "destructive" });
      return;
    }

    try {
      toast({ title: "جاري استبدال الملف..." });
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storageRef = ref(storage, `transactions/${targetTransaction.id}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      if (currentAttachment.url) await deleteAttachmentFromFirebase(currentAttachment.url);

      const newAttachment = { ...currentAttachment, name: file.name, url: downloadURL, type: fileType, uploadDate: new Date() };
      const updatedAttachments = targetTransaction.attachments?.map((att, index) => index === currentPreviewIndex ? newAttachment : att) || [];
      const updatedTransaction = { ...targetTransaction, attachments: updatedAttachments };
      await updateTransaction(updatedTransaction);

      if (editingTransaction) setEditingTransaction(updatedTransaction);
      if (previewTransaction) setPreviewTransaction(updatedTransaction);
      setPreviewAttachments(updatedAttachments);
      setImageLoadError(false);
      setImageLoading(true);
      setRetryCount(0);
      toast({ title: "تم استبدال الملف بنجاح" });
    } catch (error) {
      toast({ title: "خطأ في الاستبدال", description: "حدث خطأ أثناء استبدال الملف.", variant: "destructive" });
    } finally {
      event.target.value = '';
    }
  };

  const handlePreviewAttachments = (attachments: Transaction['attachments'], transaction?: Transaction) => {
    if (attachments && attachments.length > 0) {
      setPreviewAttachments(attachments);
      setPreviewTransaction(transaction || editingTransaction || null);
      setCurrentPreviewIndex(0);
      setImageLoadError(false);
      setImageLoading(true);
      setRetryCount(0);
      setIsPreviewOpen(true);
    }
  };

  const handlePreviousAttachment = () => {
    setCurrentPreviewIndex(prev => prev > 0 ? prev - 1 : (previewAttachments?.length || 1) - 1);
    setImageLoadError(false);
    setImageLoading(true);
    setRetryCount(0);
  };

  const handleNextAttachment = () => {
    setCurrentPreviewIndex(prev => prev < (previewAttachments?.length || 1) - 1 ? prev + 1 : 0);
    setImageLoadError(false);
    setImageLoading(true);
    setRetryCount(0);
  };

  const onSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true);
    try {
      const totalPurchasePrice = (values.quantity || 0) * (values.purchasePrice || 0);
      const totalSellingPrice = (values.sellingPrice || 0) > 0 ? (values.quantity || 0) * (values.sellingPrice || 0) : 0;
      const profit = totalSellingPrice > 0 ? totalSellingPrice - totalPurchasePrice - (values.taxes || 0) : 0;
      const actualQuantityDeducted = values.actualQuantityDeducted || 0;
      const remainingQuantity = (values.quantity || 0) - actualQuantityDeducted;
      const remainingAmount = remainingQuantity * (values.purchasePrice || 0);

      let transactionData = { ...values, totalPurchasePrice, totalSellingPrice, profit, description: values.description || 'عملية غير محددة', remainingQuantity, remainingAmount };
      
      if (editingTransaction) {
        let updatedTransaction = { ...editingTransaction, ...transactionData };
        if (attachments.length > 0) {
          setIsUploadingAttachments(true);
          const uploadedAttachments = await uploadAttachmentsToFirebase(editingTransaction.id);
          if (uploadedAttachments.length > 0) {
            updatedTransaction = { ...updatedTransaction, attachments: [...(editingTransaction.attachments || []), ...uploadedAttachments] };
          }
          setIsUploadingAttachments(false);
        }
        await updateTransaction(updatedTransaction);
        toast({ title: "نجاح", description: "تم تعديل العملية بنجاح." });
      } else {
        const newTransaction = await addTransaction(transactionData as Omit<Transaction, 'id'>);
        if (attachments.length > 0) {
          setIsUploadingAttachments(true);
          const uploadedAttachments = await uploadAttachmentsToFirebase(newTransaction.id);
          if (uploadedAttachments.length > 0) await updateTransaction({ ...newTransaction, attachments: uploadedAttachments });
          setIsUploadingAttachments(false);
        }
        toast({ title: "نجاح", description: "تمت إضافة العملية بنجاح." });
      }
      form.reset();
      setAttachments([]);
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: "خطأ في الإدخال", description: "حدث خطأ أثناء حفظ العملية.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsUploadingAttachments(false);
    }
  };
  
  const handleDeleteTransaction = async (transactionId: string) => await deleteTransaction(transactionId);
  
  const handleCreatePaymentFromTransaction = async (transaction: Transaction) => {
    try {
      await createCustomerPaymentFromTransaction(transaction);
      toast({ title: "نجاح", description: `تم إنشاء مدفوعة من العملية ${transaction.operationNumber || transaction.id} بنجاح.` });
    } catch (error) {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إنشاء المدفوعة.", variant: "destructive" });
    }
  };

  const filteredAndSortedTransactions = useMemo(() => {
    return transactions.filter(t => {
      const searchMatch =
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.operationNumber && t.operationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.customerName && t.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.governorate && t.governorate.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.city && t.city.toLowerCase().includes(searchTerm.toLowerCase()));
      
      let dateMatch = true;
      if (startDate || endDate) {
        const targetDate = dateType === 'operation' ? t.date : (t.executionDate || t.date);
        if (startDate && endDate) dateMatch = targetDate >= startDate && targetDate <= endDate;
        else if (startDate) dateMatch = targetDate >= startDate;
        else if (endDate) dateMatch = targetDate <= endDate;
      }
      return searchMatch && dateMatch;
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
  }, [transactions, searchTerm, startDate, endDate, dateType]);

  const totalPurchasePriceDisplay = (watchedValues.quantity || 0) * (watchedValues.purchasePrice || 0);
  const totalSellingPriceDisplay = (watchedValues.sellingPrice || 0) > 0 ? (watchedValues.quantity || 0) * (watchedValues.sellingPrice || 0) : 0;
  const profitDisplay = (watchedValues.sellingPrice || 0) > 0 ? totalSellingPriceDisplay - totalPurchasePriceDisplay - (watchedValues.taxes || 0) : 0;
  
  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 animate-pulse">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-primary">سجل العمليات</h1>
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
    <div className="container mx-auto">
      <header className="flex items-center justify-between mb-8 pt-8 px-4 md:px-8">
        <h1 className="text-3xl font-bold text-primary">سجل العمليات</h1>
        <Button onClick={() => handleOpenDialog(null)}><Plus className="ml-2 h-4 w-4" />إضافة عملية</Button>
      </header>
      
      <Card className="mx-4 md:mx-8">
          <CardHeader>
              <CardTitle>فلترة العمليات</CardTitle>
              <div className="flex flex-col md:flex-row gap-2 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="بحث برقم العملية، اسم العميل، الوصف أو اسم المورد..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex items-center gap-2">
                      <Select value={dateType} onValueChange={(value) => setDateType(value as 'operation' | 'execution')}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operation">تاريخ العملية</SelectItem>
                          <SelectItem value="execution">تاريخ التنفيذ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className={cn("w-full md:w-[180px] justify-start text-right font-normal", !startDate && "text-muted-foreground")}>
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP", { locale: ar }) : <span>من تاريخ</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar mode="single" selected={startDate} onSelect={(date) => { setStartDate(date); setIsStartDatePopoverOpen(false); }} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className={cn("w-full md:w-[180px] justify-start text-right font-normal", !endDate && "text-muted-foreground")}>
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP", { locale: ar }) : <span>إلى تاريخ</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar mode="single" selected={endDate} onSelect={(date) => { setEndDate(date); setIsEndDatePopoverOpen(false); }} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(value) => setDateRangePreset(value as 'today' | 'week' | 'month' | 'all')}>
                        <SelectTrigger className="w-[120px]"><SelectValue placeholder="مدة سريعة" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">اليوم</SelectItem>
                          <SelectItem value="week">هذا الأسبوع</SelectItem>
                          <SelectItem value="month">هذا الشهر</SelectItem>
                          <SelectItem value="all">الكل</SelectItem>
                        </SelectContent>
                      </Select>
                      {(startDate || endDate) && (<Button variant="ghost" onClick={clearDateFilter} className="text-destructive">مسح الفلتر</Button>)}
                    </div>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>م</TableHead>
                    <TableHead>رقم العملية</TableHead>
                    <TableHead>اسم العميل</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>تاريخ التنفيذ</TableHead>
                    <TableHead>اسم المورد</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المنطقة</TableHead>
                    <TableHead>الكمية / التفاصيل</TableHead>
                    <TableHead>الكمية المخصومة</TableHead>
                    <TableHead>الكمية المتبقية</TableHead>
                    <TableHead>المبلغ المتبقي</TableHead>
                    <TableHead>إجمالي الشراء</TableHead>
                    <TableHead>إجمالي البيع</TableHead>
                    <TableHead>صافي الربح</TableHead>
                    <TableHead>المدفوع للمصنع</TableHead>
                    <TableHead>القائم بالدفع</TableHead>
                    <TableHead>طريقة دفع المصنع</TableHead>
                    <TableHead>المستلم من المورد</TableHead>
                    <TableHead>طريقة استلام المورد</TableHead>
                    <TableHead>المستلم من العميل</TableHead>
                    <TableHead>طريقة استلام العميل</TableHead>
                    <TableHead>الناقل</TableHead>
                    <TableHead>هاتف الناقل</TableHead>
                    <TableHead>تاريخ الخروج</TableHead>
                    <TableHead>المرفقات</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedTransactions.map((t, index) => (
                    <TableRow key={t.id}>
                      <TableCell>{filteredAndSortedTransactions.length - index}</TableCell>
                      <TableCell>{t.operationNumber || '-'}</TableCell>
                      <TableCell>{t.customerName || '-'}</TableCell>
                      <TableCell>{format(t.date, 'dd-MM-yy')}</TableCell>
                      <TableCell>{t.showExecutionDate && t.executionDate ? format(t.executionDate, 'dd MMMM yyyy', { locale: ar }) : '-'}</TableCell>
                      <TableCell>{t.supplierName}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell>{t.governorate || '-'}{t.city ? ` - ${t.city}` : ''}</TableCell>
                      <TableCell>{t.quantity} طن{t.variety ? ` / ${t.variety}` : ''}</TableCell>
                      <TableCell className="text-orange-600 font-medium">{(t.actualQuantityDeducted || 0).toFixed(2)} طن</TableCell>
                      <TableCell className="text-blue-600 font-medium">{(t.remainingQuantity || 0).toFixed(2)} طن</TableCell>
                      <TableCell className="text-green-600 font-medium">{(t.remainingAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>{t.totalPurchasePrice.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>{t.totalSellingPrice > 0 ? t.totalSellingPrice.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : '-'}</TableCell>
                      <TableCell className={t.profit >= 0 ? 'text-success' : 'text-destructive'}>{t.profit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>{t.amountPaidToFactory.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>{t.paidBy || '-'}</TableCell>
                      <TableCell>
                        {t.paymentMethodToFactory === 'نقدي' && '💵 نقدي'}
                        {t.paymentMethodToFactory === 'تحويل بنكي' && '🏦 تحويل بنكي'}
                        {t.paymentMethodToFactory === 'إيداع' && '💳 إيداع'}
                        {!t.paymentMethodToFactory && '-'}
                      </TableCell>
                      <TableCell>{t.amountReceivedFromSupplier.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>
                        {t.paymentMethodFromSupplier === 'نقدي' && '💵 نقدي'}
                        {t.paymentMethodFromSupplier === 'تحويل بنكي' && '🏦 تحويل بنكي'}
                        {t.paymentMethodFromSupplier === 'إيداع' && '💳 إيداع'}
                        {!t.paymentMethodFromSupplier && '-'}
                      </TableCell>
                      <TableCell>{(t.amountReceivedFromCustomer || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>
                        {t.paymentMethodFromCustomer === 'نقدي' && '💵 نقدي'}
                        {t.paymentMethodFromCustomer === 'تحويل بنكي' && '🏦 تحويل بنكي'}
                        {t.paymentMethodFromCustomer === 'إيداع' && '💳 إيداع'}
                        {t.paymentMethodFromCustomer === 'شيك' && '📄 شيك'}
                        {!t.paymentMethodFromCustomer && '-'}
                      </TableCell>
                      <TableCell>{t.carrierName || '-'}</TableCell>
                      <TableCell>{t.carrierPhone || '-'}</TableCell>
                      <TableCell>{t.departureDate ? format(t.departureDate, 'dd-MM-yy') : '-'}</TableCell>
                      <TableCell>
                        {t.attachments && t.attachments.length > 0 ? (
                          <button
                            onClick={() => handlePreviewAttachments(t.attachments, t)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">{t.attachments.length}</span>
                          </button>
                        ) : ('-')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(t)}><Pencil className="h-4 w-4" /></Button>
                          {t.customerName && (<Button variant="ghost" size="icon" onClick={() => handleCreatePaymentFromTransaction(t)} title="إنشاء مدفوعة عميل من هذه العملية"><CreditCard className="h-4 w-4 text-blue-600" /></Button>)}
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle><AlertDialogDescription>هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف العملية بشكل دائم.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTransaction(t.id)}>متابعة</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </CardContent>
      </Card>
      {/* Dialogs and other components */}
      <Dialog open={isDialogOpen} onOpenChange={onDialogOpenChange}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingTransaction ? 'تعديل عملية' : 'إضافة عملية جديدة'}</DialogTitle>
                <DialogDescription>
                  {editingTransaction ? 'قم بتعديل بيانات العملية أدناه' : 'أدخل بيانات العملية الجديدة أدناه'}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[80vh] overflow-y-auto p-4">
                  <Accordion type="multiple" defaultValue={['item-1']} className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>المعلومات الأساسية</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                          <FormField control={form.control} name="operationNumber" render={({ field }) => (
                            <FormItem><FormLabel>رقم العملية (اختياري)</FormLabel><FormControl><Input placeholder="رقم العملية" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>اسم العميل (اختياري)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="اختر العميل" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {customerNames.map((name) => (
                                      <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="supplierName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>اسم المورد</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="اختر المورد" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {supplierNames.map((name) => (
                                      <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>تاريخ العملية</FormLabel><Popover modal={false} open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsDatePopoverOpen(false); }} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="governorate" render={({ field }) => (
                            <FormItem><FormLabel>المحافظة (اختياري)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger></FormControl><SelectContent>{governorates.map(gov => <SelectItem key={gov} value={gov}>{gov}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem><FormLabel>المركز (اختياري)</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!availableCities.length}><FormControl><SelectTrigger><SelectValue placeholder="اختر المركز" /></SelectTrigger></FormControl><SelectContent>{availableCities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>الوصف</FormLabel>
                              <FormControl>
                                <EditableDropdown
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  placeholder="اختر أو أضف شركة أسمنت..."
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>تفاصيل البضاعة والتسعير (اختياري)</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                           <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem><FormLabel>الصنف (اختياري)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger></FormControl><SelectContent>{categoryOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="variety" render={({ field }) => (
                            <FormItem><FormLabel>النوع (اختياري)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger></FormControl><SelectContent>{varietyOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                           )} />
                          <FormField control={form.control} name="quantity" render={({ field }) => (
                            <FormItem><FormLabel>الكمية</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                           <FormField control={form.control} name="taxes" render={({ field }) => (
                            <FormItem><FormLabel>الضرائب</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                          <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                            <FormItem><FormLabel>سعر الشراء</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="sellingPrice" render={({ field }) => (
                            <FormItem><FormLabel>سعر البيع</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                           <FormItem><Label>إجمالي سعر الشراء</Label><Input type="number" value={totalPurchasePriceDisplay.toFixed(2)} readOnly className="font-bold bg-muted" /></FormItem>
                           <FormItem><Label>إجمالي سعر البيع</Label><Input type="number" value={totalSellingPriceDisplay.toFixed(2)} readOnly className="font-bold bg-muted" /></FormItem>
                        </div>
                        <FormItem className="mt-4">
                           <Label>صافي الربح</Label>
                           <Input type="number" value={profitDisplay.toFixed(2)} readOnly className={`font-bold ${profitDisplay >= 0 ? 'bg-success/20' : 'bg-destructive/20'}`} />
                        </FormItem>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>المدفوعات والتواريخ الهامة</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                          <FormField control={form.control} name="amountPaidToFactory" render={({ field }) => (
                            <FormItem><FormLabel>المبلغ المدفوع للمصنع</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField
                            control={form.control}
                            name="paidBy"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>القائم بالدفع</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="اختر القائم بالدفع" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {supplierNames.map((name) => (
                                      <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField control={form.control} name="paymentMethodToFactory" render={({ field }) => (
                            <FormItem><FormLabel>طريقة الدفع للمصنع</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger></FormControl><SelectContent><SelectItem value="نقدي">نقدي</SelectItem><SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem><SelectItem value="إيداع">إيداع</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="amountReceivedFromSupplier" render={({ field }) => (
                            <FormItem><FormLabel>المبلغ المستلم من المورد</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="paymentMethodFromSupplier" render={({ field }) => (
                            <FormItem><FormLabel>طريقة الاستلام من المورد</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر طريقة الاستلام" /></SelectTrigger></FormControl><SelectContent><SelectItem value="نقدي">نقدي</SelectItem><SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem><SelectItem value="إيداع">إيداع</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          
                          <FormField control={form.control} name="amountReceivedFromCustomer" render={({ field }) => (
                            <FormItem><FormLabel>المبلغ المستلم من العميل</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="paymentMethodFromCustomer" render={({ field }) => (
                            <FormItem><FormLabel>طريقة الاستلام من العميل</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر طريقة الاستلام" /></SelectTrigger></FormControl><SelectContent><SelectItem value="نقدي">نقدي</SelectItem><SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem><SelectItem value="إيداع">إيداع</SelectItem><SelectItem value="شيك">شيك</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="dateReceivedFromCustomer" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>تاريخ الاستلام من العميل</FormLabel><Popover modal={false} open={isDateReceivedPopoverOpen} onOpenChange={setIsDateReceivedPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsDateReceivedPopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />


                          <FormField control={form.control} name="executionDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>تاريخ التنفيذ (اختياري)</FormLabel><Popover modal={false} open={isExecDatePopoverOpen} onOpenChange={setIsExecDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsExecDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="showExecutionDate" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  className="h-4 w-4 rounded border"
                                />
                              </FormControl>
                              <FormLabel className="mb-0 flex-1 cursor-pointer">إظهار تاريخ التنفيذ</FormLabel>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="dueDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>تاريخ الاستحقاق (اختياري)</FormLabel><Popover modal={false} open={isDueDatePopoverOpen} onOpenChange={setIsDueDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsDueDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-6">
                      <AccordionTrigger>بيانات الناقل (اختياري)</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                          <FormField control={form.control} name="carrierName" render={({ field }) => (
                            <FormItem><FormLabel>اسم الناقل</FormLabel><FormControl><Input placeholder="اسم السائق أو شركة النقل" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="carrierPhone" render={({ field }) => (
                            <FormItem><FormLabel>رقم هاتف الناقل</FormLabel><FormControl><Input type="tel" placeholder="01xxxxxxxxx" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="departureDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>تاريخ الخروج</FormLabel><Popover modal={false} open={isDepartureDatePopoverOpen} onOpenChange={setIsDepartureDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ الخروج</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsDepartureDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4">
                      <AccordionTrigger>إدارة المخزون (للصنف السائب)</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                          <FormField control={form.control} name="transactionNumber" render={({ field }) => (
                            <FormItem><FormLabel>رقم العملية (تخزين)</FormLabel><FormControl><Input placeholder="رقم العملية للمخزون" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="transactionDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>تاريخ العملية (تخزين)</FormLabel><Popover modal={false} open={isTransactionDatePopoverOpen} onOpenChange={setIsTransactionDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsTransactionDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="actualQuantityDeducted" render={({ field }) => (
                            <FormItem><FormLabel>الكمية الفعلية المخصومة</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                           <FormItem>
                             <Label>الكمية المتبقية</Label>
                             <Input 
                               type="number" 
                               value={((watchedValues.quantity || 0) - (watchedValues.actualQuantityDeducted || 0)).toFixed(2)} 
                               readOnly 
                               className="font-bold bg-blue-50" 
                             />
                           </FormItem>
                           <FormItem>
                             <Label>المبلغ المتبقي</Label>
                             <Input 
                               type="number" 
                               value={(((watchedValues.quantity || 0) - (watchedValues.actualQuantityDeducted || 0)) * (watchedValues.purchasePrice || 0)).toFixed(2)} 
                               readOnly 
                               className="font-bold bg-green-50" 
                             />
                           </FormItem>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-5">
                      <AccordionTrigger>المرفقات والمستندات</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor="factory-payment-files" className="cursor-pointer">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                  <span className="text-sm">مستندات دفع المصنع</span>
                                </div>
                              </Label>
                              <input
                                id="factory-payment-files"
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, 'factory_payment')}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="supplier-receipt-files" className="cursor-pointer">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-green-500 transition-colors">
                                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                  <span className="text-sm">إيصالات المورد</span>
                                </div>
                              </Label>
                              <input
                                id="supplier-receipt-files"
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, 'supplier_receipt')}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="invoice-files" className="cursor-pointer">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-orange-500 transition-colors">
                                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                  <span className="text-sm">الفواتير</span>
                                </div>
                              </Label>
                              <input
                                id="invoice-files"
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, 'invoice')}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="other-files" className="cursor-pointer">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition-colors">
                                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                  <span className="text-sm">مستندات أخرى</span>
                                </div>
                              </Label>
                              <input
                                id="other-files"
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, 'other')}
                              />
                            </div>
                          </div>
                          
                          {/* عرض المرفقات الموجودة */}
                          {editingTransaction && editingTransaction.attachments && editingTransaction.attachments.length > 0 && (
                            <div className="mt-4">
                              <Label className="text-sm font-medium">المرفقات الموجودة:</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                {editingTransaction.attachments.map((attachment, index) => (
                                  <div key={attachment.id || attachment.url} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                                    <div className="flex items-center space-x-3 flex-1">
                                      {attachment.type === 'image' ? (
                                        <Image className="h-5 w-5 text-blue-500" />
                                      ) : (
                                        <FileText className="h-5 w-5 text-red-500" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {attachment.category === 'factory_payment' && 'دفع المصنع'}
                                          {attachment.category === 'supplier_receipt' && 'إيصال المورد'}
                                          {attachment.category === 'invoice' && 'فاتورة'}
                                          {attachment.category === 'other' && 'أخرى'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 mr-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setCurrentPreviewIndex(index);
                                          handlePreviewAttachments(editingTransaction.attachments || [], editingTransaction);
                                        }}
                                        title="معاينة"
                                      >
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newName = prompt('أدخل اسم جديد للملف:', attachment.name);
                                          if (newName && newName.trim() && newName !== attachment.name) {
                                            const updatedAttachments = editingTransaction.attachments?.map((att, i) => 
                                              i === index 
                                                ? { ...att, name: newName.trim() }
                                                : att
                                            );
                                            setEditingTransaction({
                                              ...editingTransaction,
                                              attachments: updatedAttachments || []
                                            });
                                            toast({
                                              title: "تم تحديث الملف",
                                              description: "تم تغيير اسم الملف بنجاح",
                                            });
                                          }
                                        }}
                                        title="تعديل الاسم"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          // Set up for replacement
                                          setCurrentPreviewIndex(index);
                                          setPreviewTransaction(editingTransaction);
                                          setPreviewAttachments(editingTransaction.attachments || []);
                                          // Trigger file input
                                          const fileInput = document.getElementById('replace-file-input') as HTMLInputElement;
                                          if (fileInput) {
                                            fileInput.click();
                                          }
                                        }}
                                        title="استبدال الملف"
                                      >
                                        <Upload className="h-4 w-4 text-blue-500" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const attachment = editingTransaction.attachments?.[index];
                                          if (attachment) {
                                            handleDeleteExistingAttachment(attachment.id || attachment.url, attachment.url);
                                          }
                                        }}
                                        title="حذف"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* عرض المرفقات المحملة */}
                          {attachments.length > 0 && (
                            <div className="mt-4">
                              <Label className="text-sm font-medium">المرفقات المحملة:</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                {attachments.map((attachment) => (
                                  <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                    <div className="flex items-center space-x-3">
                                      {attachment.type === 'image' ? (
                                        <Image className="h-5 w-5 text-blue-500" />
                                      ) : (
                                        <FileText className="h-5 w-5 text-red-500" />
                                      )}
                                      <div>
                                        <p className="text-sm font-medium truncate max-w-[200px]">{attachment.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {attachment.category === 'factory_payment' && 'دفع المصنع'}
                                          {attachment.category === 'supplier_receipt' && 'إيصال المورد'}
                                          {attachment.category === 'invoice' && 'فاتورة'}
                                          {attachment.category === 'other' && 'أخرى'}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeAttachment(attachment.id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <DialogFooter className="pt-4">
                    {editingTransaction && (<AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="destructive" className="mr-auto"><Trash2 className="ml-2 h-4 w-4" />حذف</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle><AlertDialogDescription>هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف العملية بشكل دائم.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={async () => { if (editingTransaction) { await handleDeleteTransaction(editingTransaction.id); setIsDialogOpen(false); setEditingTransaction(null); } }}>متابعة</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
                    <DialogClose asChild><Button type="button" variant="secondary">إلغاء</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting || isUploadingAttachments}>
                      {isSubmitting 
                        ? 'جاري الحفظ...' 
                        : isUploadingAttachments 
                        ? 'جاري رفع المرفقات...' 
                        : (editingTransaction ? 'حفظ التعديلات' : 'حفظ العملية')
                      }
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
    </div>
  );
}



    
    

    