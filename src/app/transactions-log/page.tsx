

"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';

const transactionSchema = z.object({
  operationNumber: z.string().optional(),
  operationKey: z.string().optional(),
  customerName: z.string().optional(),
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  
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
  paidBy: z.string().optional(), 
  datePaidToFactory: z.date().optional(),
  factoryPayments: z
    .array(
      z.object({
        amount: z.coerce.number().min(0, 'المبلغ يجب أن يكون موجبًا.'),
        paidBy: z.string().optional(),
        date: z.coerce.date().optional(),
        method: z.enum(['نقدي', 'تحويل بنكي', 'إيداع']).optional(),
      })
    )
    .optional(),
  
  amountReceivedFromSupplier: z.coerce.number().min(0, 'المبلغ المستلم يجب أن يكون موجبًا.').default(0),
  receivedBy: z.string().optional(),
  dateReceivedFromSupplier: z.date().optional(),

  notes: z.string().optional(),
  
  paymentMethodToFactory: z.enum(['نقدي', 'تحويل بنكي', 'إيداع']).optional(),
  paymentMethodFromSupplier: z.enum(['نقدي', 'تحويل بنكي', 'إيداع']).optional(),
  
  actualQuantityDeducted: z.coerce.number().min(0, 'الكمية الفعلية يجب أن تكون موجبة.').optional(),
  otherQuantityDeducted: z.coerce.number().min(0, 'الكمية يجب أن تكون موجبة.').optional(),
  transactionDate: z.date().optional(),
  transactionNumber: z.string().optional(),

  carrierName: z.string().optional(),
  carrierPhone: z.string().optional(),
  departureDate: z.date().optional(),

  amountReceivedFromCustomer: z.coerce.number().min(0).optional(),
  dateReceivedFromCustomer: z.date().optional(),
  paymentMethodFromCustomer: z.enum(['نقدي', 'تحويل بنكي', 'إيداع', 'شيك']).optional(),
  customerPaymentReceivedBy: z.string().optional(),
  customerPayments: z.array(z.object({
    amount: z.coerce.number().min(0, 'المبلغ يجب أن يكون موجباً.'),
    date: z.date().optional(),
    method: z.enum(['نقدي', 'تحويل بنكي', 'إيداع', 'شيك']).optional(),
    receivedBy: z.string().optional(),
    notes: z.string().optional(),
  applied: z.boolean().optional(),
  })).optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

function TransactionsLogPageContent() {
  const searchParams = useSearchParams();
  const customerQuery = searchParams.get('customer');

  const { 
    transactions, addTransaction, updateTransaction, deleteTransaction, 
    loading,
    createCustomerPaymentFromTransaction,
    supplierNames,
    customerNames
  } = useTransactions();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState(customerQuery || '');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  // Additional filters: quantity + details (category/variety)
  const [minQuantity, setMinQuantity] = useState('');
  const [maxQuantity, setMaxQuantity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVariety, setFilterVariety] = useState('');
  
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingWithPayment, setIsSubmittingWithPayment] = useState(false); // حفظ مع إنشاء دفعة
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewAttachments, setPreviewAttachments] = useState<Transaction['attachments']>([]);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [customerAmountManuallyEdited, setCustomerAmountManuallyEdited] = useState(false);
  const [lastEditedDeductField, setLastEditedDeductField] = useState<'actual' | 'other' | null>(null);
  
  const [attachments, setAttachments] = useState<Array<{
    id: string;
    name: string;
    file: File;
    type: 'image' | 'pdf' | 'document';
    category: 'factory_payment' | 'supplier_receipt' | 'invoice' | 'other';
    preview?: string;
  }>>([]);
  
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  
  
  const [isTransactionDatePopoverOpen, setIsTransactionDatePopoverOpen] = useState(false);
  const [isDepartureDatePopoverOpen, setIsDepartureDatePopoverOpen] = useState(false);
  const [isDateReceivedPopoverOpen, setIsDateReceivedPopoverOpen] = useState(false);
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
  const [isDatePaidToFactoryPopoverOpen, setIsDatePaidToFactoryPopoverOpen] = useState(false);
  const [isDateReceivedFromSupplierPopoverOpen, setIsDateReceivedFromSupplierPopoverOpen] = useState(false);
  // Multi-selection state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [hoverSelectMode, setHoverSelectMode] = useState(false);
  const [factoryPaymentDatePopoverOpen, setFactoryPaymentDatePopoverOpen] = useState<Record<number, boolean>>({});
  const [isOpReportOpen, setIsOpReportOpen] = useState(false);
  const [reportTx, setReportTx] = useState<Transaction | null>(null);
  const handleOpenOperationReport = (t: Transaction) => { setReportTx(t); setIsOpReportOpen(true); };

  const toggleRowSelection = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addRowSelection = (id: string) => {
    setSelectedRowIds(prev => (prev.has(id) ? prev : new Set([...Array.from(prev), id])));
  };

  const clearSelection = () => setSelectedRowIds(new Set());

  useEffect(() => {
    if (customerQuery) {
      setSearchTerm(customerQuery);
    }
  }, [customerQuery]);

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
  };
  
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const allEntities = useMemo(() => Array.from(new Set([...supplierNames, ...customerNames])).sort(), [supplierNames, customerNames]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { 
      operationNumber: "",
  operationKey: "",
      customerName: "",
      date: new Date(), 
      
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
      datePaidToFactory: undefined,
  factoryPayments: [],
      amountReceivedFromSupplier: 0, 
      receivedBy: "",
      dateReceivedFromSupplier: undefined,
      
      paymentMethodToFactory: undefined,
      paymentMethodFromSupplier: undefined,
      actualQuantityDeducted: 0,
  otherQuantityDeducted: 0,
      transactionNumber: "",
      carrierName: "",
      carrierPhone: "",
      departureDate: undefined,
      amountReceivedFromCustomer: 0,
      dateReceivedFromCustomer: undefined,
      paymentMethodFromCustomer: undefined,
      customerPaymentReceivedBy: "",
      notes: "",
  customerPayments: [],
    },
  });
  const { watch, setValue } = form;
  const watchedValues = watch();
  const watchedCustomerPayments = watch('customerPayments');
  const watchedAmountReceivedFromCustomer = watch('amountReceivedFromCustomer');
  const watchedPaymentMethodFromCustomer = watch('paymentMethodFromCustomer');
  const watchedDateReceivedFromCustomer = watch('dateReceivedFromCustomer');
  const watchedCustomerPaymentReceivedBy = watch('customerPaymentReceivedBy');
  const selectedGovernorate = watch("governorate");
  const watchedOperationKey = watch("operationKey");

  useEffect(() => {
      if (selectedGovernorate) {
          setAvailableCities(cities[selectedGovernorate] || []);
          setValue("city", "", { shouldValidate: false });
      } else {
          setAvailableCities([]);
      }
  }, [selectedGovernorate, setValue]);

  // Aggregates for the same operation key (excluding current editing record)
  const { opAssignedQtyOther, opDeductedQtyOther, opReceivedFromCustomerOther } = useMemo(() => {
    const key = (watchedOperationKey || '').trim();
    if (!key) return { opAssignedQtyOther: 0, opDeductedQtyOther: 0, opReceivedFromCustomerOther: 0 };
    const others = transactions.filter(t => (t.operationKey || '').trim() === key && (!editingTransaction || t.id !== editingTransaction.id));
    const opAssignedQtyOther = others.reduce((s, t) => s + (Number(t.quantity) || 0), 0);
    const opDeductedQtyOther = others.reduce((s, t) => s + ((Number(t.actualQuantityDeducted) || 0) + (Number(t.otherQuantityDeducted) || 0)), 0);
    const opReceivedFromCustomerOther = others.reduce((s, t) => s + (Number(t.amountReceivedFromCustomer) || 0), 0);
    return { opAssignedQtyOther, opDeductedQtyOther, opReceivedFromCustomerOther };
  }, [transactions, watchedOperationKey, editingTransaction]);

  const currentAssignedQty = (Number(watchedValues.quantity) || 0);
  const currentDeductedQty = (Number(watchedValues.actualQuantityDeducted) || 0) + (Number(watchedValues.otherQuantityDeducted) || 0);
  const totalAssignedForKey = opAssignedQtyOther + currentAssignedQty;
  const remainingQtyForKeyBeforeCurrent = totalAssignedForKey - opDeductedQtyOther;
  const remainingQtyForKeyAfterCurrent = Math.max(0, remainingQtyForKeyBeforeCurrent - currentDeductedQty);

  // Clamp current deduction to not exceed remaining for same key
  useEffect(() => {
    const key = (watchedOperationKey || '').trim();
    if (!key) return;
    const allowed = Math.max(0, remainingQtyForKeyBeforeCurrent);
    const sum = currentDeductedQty;
    if (sum > allowed + 1e-9) {
      const excess = sum - allowed;
      if (lastEditedDeductField === 'actual') {
        const newVal = Math.max(0, (watchedValues.actualQuantityDeducted || 0) - excess);
        setValue('actualQuantityDeducted', parseFloat(newVal.toFixed(3)), { shouldDirty: true });
        toast({ title: 'تنبيه', description: 'لا يمكن خصم أكثر من المتبقي على نفس المفتاح. تم ضبط القيمة.', variant: 'destructive' });
      } else if (lastEditedDeductField === 'other') {
        const newVal = Math.max(0, (watchedValues.otherQuantityDeducted || 0) - excess);
        setValue('otherQuantityDeducted', parseFloat(newVal.toFixed(3)), { shouldDirty: true });
        toast({ title: 'تنبيه', description: 'لا يمكن خصم أكثر من المتبقي على نفس المفتاح. تم ضبط القيمة.', variant: 'destructive' });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeductedQty, remainingQtyForKeyBeforeCurrent, watchedOperationKey]);

  // Auto-calc customer amount from deducted qty x selling price (unless manually overridden)
  useEffect(() => {
    if (customerAmountManuallyEdited) return;
    const sp = (watchedValues.sellingPrice || 0);
    const qty = (watchedValues.actualQuantityDeducted || 0) + (watchedValues.otherQuantityDeducted || 0);
    const suggested = parseFloat((qty * sp).toFixed(2));
    setValue('amountReceivedFromCustomer', suggested, { shouldDirty: true });
  }, [watchedValues.actualQuantityDeducted, watchedValues.otherQuantityDeducted, watchedValues.sellingPrice, setValue, customerAmountManuallyEdited]);

  // Parse dynamic operation key like "42.5/اسم" to set variety and customerName, and default category to "سائب"
  useEffect(() => {
    const key = (watchedOperationKey || '').trim();
    if (!key) return;
    const parts = key.split('/');
    if (parts.length >= 2) {
      const first = parts[0].trim();
      const second = parts.slice(1).join('/').trim();
      // If first matches a known variety option, set it; otherwise ignore
      if (varietyOptions.includes(first)) {
        setValue('variety', first as any, { shouldValidate: false, shouldDirty: true });
      }
      if (second) {
        setValue('customerName', second as any, { shouldValidate: false, shouldDirty: true });
      }
      if (!watchedValues.category) {
        setValue('category', 'سائب' as any, { shouldValidate: false, shouldDirty: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedOperationKey]);

  // دمج إجمالي دفعات العميل الديناميكية في الحقل الرئيسي إذا لم يتم تعديل الحقل يدويًا
  useEffect(() => {
    if (customerAmountManuallyEdited) return;
    const total = (watchedCustomerPayments || []).reduce((s, p) => s + (p.amount || 0), 0);
    if (total > 0) {
      setValue('amountReceivedFromCustomer', parseFloat(total.toFixed(2)), { shouldDirty: true });
    }
  }, [watchedCustomerPayments, customerAmountManuallyEdited, setValue]);

  // عند تعديل عملية: مزامنة الحقل الفردي (دفعة من العميل) مع صف واحد في مصفوفة الدفعات (بدون خلق حلقة تحديث لا نهائية)
  const lastSyncSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editingTransaction) return; // فقط في وضع التعديل
    if (typeof watchedAmountReceivedFromCustomer !== 'number' || watchedAmountReceivedFromCustomer <= 0) return;
    const cps = (watch('customerPayments') as any[]) || [];
    if (cps.length > 1) return; // المستخدم يدير عدة صفوف يدوياً
    const sig = [
      watchedAmountReceivedFromCustomer,
      watchedPaymentMethodFromCustomer || '',
      watchedDateReceivedFromCustomer ? watchedDateReceivedFromCustomer.getTime() : '',
      watchedCustomerPaymentReceivedBy || ''
    ].join('|');
    if (lastSyncSigRef.current === sig) return; // لا تغيير فعلي
    lastSyncSigRef.current = sig;
    if (cps.length === 0) {
      setValue('customerPayments', [{
        amount: watchedAmountReceivedFromCustomer,
        method: watchedPaymentMethodFromCustomer || undefined,
        date: watchedDateReceivedFromCustomer || undefined,
        receivedBy: watchedCustomerPaymentReceivedBy || '',
        notes: ''
      }] as any, { shouldDirty: true });
    } else if (cps.length === 1) {
      const c0 = cps[0];
      if (
        c0.amount !== watchedAmountReceivedFromCustomer ||
        c0.method !== watchedPaymentMethodFromCustomer ||
        c0.date !== watchedDateReceivedFromCustomer ||
        (c0.receivedBy || '') !== (watchedCustomerPaymentReceivedBy || '')
      ) {
        setValue('customerPayments', [{
          ...c0,
          amount: watchedAmountReceivedFromCustomer,
          method: watchedPaymentMethodFromCustomer || undefined,
          date: watchedDateReceivedFromCustomer || undefined,
          receivedBy: watchedCustomerPaymentReceivedBy || '',
        }] as any, { shouldDirty: true });
      }
    }
  // نراقب فقط الحقول الفردية لتفادي إعادة التشغيل بسبب تغيير مرجعي لمصفوفة الدفعات نفسها
  }, [editingTransaction, watchedAmountReceivedFromCustomer, watchedPaymentMethodFromCustomer, watchedDateReceivedFromCustomer, watchedCustomerPaymentReceivedBy, setValue, watch]);


  const handleOpenDialog = (transaction: Transaction | null) => {
    setEditingTransaction(transaction);
    // عند تعديل عملية موجودة لا نريد أن يُعاد حساب مبلغ العميل تلقائياً ويستبدل القيمة المحفوظة
    if (transaction) {
      setCustomerAmountManuallyEdited(true);
    } else {
      setCustomerAmountManuallyEdited(false);
    }
    if (transaction) {
      form.reset({
        ...transaction,
        operationNumber: transaction.operationNumber || '',
  operationKey: transaction.operationKey || '',
        customerName: transaction.customerName || '',
        paidBy: transaction.paidBy || '',
        receivedBy: transaction.receivedBy || '',
        date: new Date(transaction.date),
        
        transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate) : undefined,
        departureDate: transaction.departureDate ? new Date(transaction.departureDate) : undefined,
        datePaidToFactory: transaction.datePaidToFactory ? new Date(transaction.datePaidToFactory) : undefined,
        dateReceivedFromSupplier: transaction.dateReceivedFromSupplier ? new Date(transaction.dateReceivedFromSupplier) : undefined,
        dateReceivedFromCustomer: transaction.dateReceivedFromCustomer ? new Date(transaction.dateReceivedFromCustomer) : undefined,
        
        governorate: transaction.governorate || '',
        city: transaction.city || '',
        description: transaction.description || '',
        category: transaction.category || '',
        variety: transaction.variety || '',
        paymentMethodToFactory: transaction.paymentMethodToFactory || undefined,
        paymentMethodFromSupplier: transaction.paymentMethodFromSupplier || undefined,
  actualQuantityDeducted: transaction.actualQuantityDeducted || 0,
  otherQuantityDeducted: transaction.otherQuantityDeducted || 0,
  factoryPayments: transaction.factoryPayments || [],
        transactionNumber: transaction.transactionNumber || '',
        carrierName: transaction.carrierName || "",
        carrierPhone: transaction.carrierPhone || "",
        amountReceivedFromCustomer: transaction.amountReceivedFromCustomer || 0,
        paymentMethodFromCustomer: transaction.paymentMethodFromCustomer || undefined,
        customerPaymentReceivedBy: transaction.customerPaymentReceivedBy || "",
        notes: transaction.notes || "",
  customerPayments: (transaction as any).customerPayments || [],
      });
       if (transaction.governorate) setAvailableCities(cities[transaction.governorate] || []);
    } else {
      form.reset({ 
        operationNumber: "",
  operationKey: "",
        customerName: "",
        date: new Date(), 
        
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
        datePaidToFactory: undefined,
  factoryPayments: [],
        amountReceivedFromSupplier: 0, 
        receivedBy: "",
        dateReceivedFromSupplier: undefined,
        
        paymentMethodToFactory: undefined,
        paymentMethodFromSupplier: undefined,
  actualQuantityDeducted: 0,
  otherQuantityDeducted: 0,
        transactionNumber: "",
        carrierName: "",
        carrierPhone: "",
        departureDate: undefined,
        amountReceivedFromCustomer: 0,
        dateReceivedFromCustomer: undefined,
        paymentMethodFromCustomer: undefined,
        customerPaymentReceivedBy: "",
        notes: "",
  customerPayments: [],
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

  const fileType: 'image' | 'pdf' | 'document' = file.type.startsWith('image/') ? 'image' : (file.type === 'application/pdf' ? 'pdf' : 'document');
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

  const newAttachment: NonNullable<Transaction['attachments']>[number] = { ...currentAttachment, name: file.name, url: downloadURL, type: fileType, uploadDate: new Date() };
  const updatedAttachments: NonNullable<Transaction['attachments']> = targetTransaction.attachments?.map((att, index) => index === currentPreviewIndex ? newAttachment : att) || [];
  const updatedTransaction: Transaction = { ...targetTransaction, attachments: updatedAttachments };
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
      const otherQuantityDeducted = values.otherQuantityDeducted || 0;
      const totalDeducted = actualQuantityDeducted + otherQuantityDeducted;
      const remainingQuantity = (values.quantity || 0) - totalDeducted;
      const remainingAmount = remainingQuantity * (values.purchasePrice || 0);

      let transactionData = { 
        ...values, 
        totalPurchasePrice, 
        totalSellingPrice, 
        profit, 
        description: values.description || 'عملية غير محددة', 
        remainingQuantity, 
        remainingAmount 
      };
      
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

  // حفظ العملية الجديدة + إنشاء دفعة عميل مباشرةً (ديناميكياً من نفس البيانات)
  const onSubmitAndCreatePayment = async (values: TransactionFormValues) => {
    setIsSubmittingWithPayment(true);
    try {
      if (!values.customerName || !values.customerName.trim()) {
        toast({ title: 'تنبيه', description: 'يجب إدخال اسم العميل قبل إنشاء الدفعة.', variant: 'destructive' });
        return;
      }
      const totalPurchasePrice = (values.quantity || 0) * (values.purchasePrice || 0);
      const totalSellingPrice = (values.sellingPrice || 0) > 0 ? (values.quantity || 0) * (values.sellingPrice || 0) : 0;
      const profit = totalSellingPrice > 0 ? totalSellingPrice - totalPurchasePrice - (values.taxes || 0) : 0;
      const actualQuantityDeducted = values.actualQuantityDeducted || 0;
      const otherQuantityDeducted = values.otherQuantityDeducted || 0;
      const totalDeducted = actualQuantityDeducted + otherQuantityDeducted;
      const remainingQuantity = (values.quantity || 0) - totalDeducted;
      const remainingAmount = remainingQuantity * (values.purchasePrice || 0);

      let transactionData = {
        ...values,
        totalPurchasePrice,
        totalSellingPrice,
        profit,
        description: values.description || 'عملية غير محددة',
        remainingQuantity,
        remainingAmount,
      };

      // إنشاء العملية أولاً
      const newTransaction = await addTransaction(transactionData as Omit<Transaction, 'id'>);

      // رفع المرفقات إن وُجدت ثم تحديث العملية بالمرفقات
      if (attachments.length > 0) {
        setIsUploadingAttachments(true);
        const uploadedAttachments = await uploadAttachmentsToFirebase(newTransaction.id);
        if (uploadedAttachments.length > 0) {
          await updateTransaction({ ...newTransaction, attachments: uploadedAttachments });
        }
        setIsUploadingAttachments(false);
      }

      // إنشاء دفعة للعميل من العملية (يعتمد على totalSellingPrice)
      try {
        await createCustomerPaymentFromTransaction({ ...newTransaction, totalSellingPrice });
        toast({ title: 'نجاح', description: 'تم حفظ العملية وإنشاء الدفعة بنجاح.' });
      } catch (e) {
        toast({ title: 'تم حفظ العملية', description: 'لكن حدث خطأ أثناء إنشاء الدفعة.', variant: 'destructive' });
      }

      form.reset();
      setAttachments([]);
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء حفظ العملية وإنشاء الدفعة.', variant: 'destructive' });
    } finally {
      setIsSubmittingWithPayment(false);
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
        const targetDate = t.date;
        if (startDate && endDate) dateMatch = targetDate >= startDate && targetDate <= endDate;
        else if (startDate) dateMatch = targetDate >= startDate;
        else if (endDate) dateMatch = targetDate <= endDate;
      }

      // Quantity range
      const q = Number(t.quantity) || 0;
      const minQ = minQuantity.trim() === '' ? -Infinity : parseFloat(minQuantity);
      const maxQ = maxQuantity.trim() === '' ? Infinity : parseFloat(maxQuantity);
      const quantityMatch = q >= minQ && q <= maxQ;

      // Details filters
      const categoryMatch = filterCategory ? (t.category || '').trim() === filterCategory : true;
      const varietyMatch = filterVariety ? (t.variety || '').trim() === filterVariety : true;

      return searchMatch && dateMatch && quantityMatch && categoryMatch && varietyMatch;
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
  }, [transactions, searchTerm, startDate, endDate, minQuantity, maxQuantity, filterCategory, filterVariety]);

  // مجاميع الأعمدة (حسب الفلترة الحالية)
  const totals = useMemo(() => {
    let totalQuantity = 0;
  let totalDeductedQuantity = 0;
  let totalRemainingQuantity = 0;
    let totalDeductedPurchase = 0;
    let totalRemainingAmount = 0;
    let totalSalesSum = 0;
    let totalCustomerBalance = 0;
    let totalSupplierBalanceAtFactory = 0;
    let totalProfitSum = 0;
    let totalPaidToFactorySum = 0;
    let totalReceivedFromSupplierSum = 0;
    let totalReceivedFromCustomerSum = 0;
    filteredAndSortedTransactions.forEach(t => {
      totalQuantity += (t.quantity || 0);
      const deductedQty = (t.actualQuantityDeducted || 0) + (t.otherQuantityDeducted || 0);
  totalDeductedQuantity += deductedQty;
      totalDeductedPurchase += deductedQty * (t.purchasePrice || 0);
      const remainingAmt = typeof t.remainingAmount === 'number' ? t.remainingAmount : ((t.remainingQuantity || 0) * (t.purchasePrice || 0));
      totalRemainingAmount += remainingAmt;
  totalRemainingQuantity += (t.remainingQuantity || 0);
      const sales = (t.totalSellingPrice || 0);
      totalSalesSum += sales;
      const receivedFromCustomer = (t.amountReceivedFromCustomer || 0);
      const receivedFromSupplier = (t.amountReceivedFromSupplier || 0);
      const customerBal = (receivedFromCustomer - sales) - receivedFromSupplier;
      totalCustomerBalance += customerBal;
      totalSupplierBalanceAtFactory += remainingAmt;
      totalProfitSum += (t.profit || 0);
      const listPaid = (t.factoryPayments || []).reduce((s, p) => s + (p.amount || 0), 0);
      totalPaidToFactorySum += (t.amountPaidToFactory || 0) + listPaid;
      totalReceivedFromSupplierSum += receivedFromSupplier;
      totalReceivedFromCustomerSum += receivedFromCustomer;
    });
    return {
      totalQuantity,
      totalDeductedPurchase,
      totalRemainingAmount,
      totalSalesSum,
      totalCustomerBalance,
      totalSupplierBalanceAtFactory,
      totalProfitSum,
      totalPaidToFactorySum,
      totalReceivedFromSupplierSum,
      totalReceivedFromCustomerSum,
  totalDeductedQuantity,
  totalRemainingQuantity,
  workingCapital: totalRemainingAmount + totalCustomerBalance,
    };
  }, [filteredAndSortedTransactions]);

  // Map each unique (departureDate month) to an index to assign stable colors
  const monthIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const t of filteredAndSortedTransactions) {
      const d = t.departureDate || t.date; // fallback to main date if no departure
      const key = `${t.departureDate ? 'dep' : 'main'}-${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) map.set(key, i++);
    }
    return map;
  }, [filteredAndSortedTransactions]);

  const monthColorClasses = [
    'bg-blue-50',
    'bg-green-50',
    'bg-amber-50',
    'bg-purple-50',
    'bg-pink-50',
    'bg-slate-50',
  ];

  const getRowColorClass = (t: Transaction) => {
    const d = t.departureDate || t.date;
    const key = `${t.departureDate ? 'dep' : 'main'}-${d.getFullYear()}-${d.getMonth()}`;
    const idx = monthIndexMap.get(key) ?? 0;
    return monthColorClasses[idx % monthColorClasses.length];
  };

  // Build legend metadata
  const monthLegend = useMemo(() => {
    const seen = new Set<string>();
    const items: { key: string; label: string; className: string }[] = [];
    for (const t of filteredAndSortedTransactions) {
      const d = t.departureDate || t.date;
      const key = `${t.departureDate ? 'dep' : 'main'}-${d.getFullYear()}-${d.getMonth()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const label = t.departureDate ? format(new Date(d.getFullYear(), d.getMonth(), 1), 'MMMM yyyy', { locale: ar }) : `بدون تاريخ خروج (${format(new Date(d.getFullYear(), d.getMonth(), 1), 'MMMM yyyy', { locale: ar })})`;
      const idx = monthIndexMap.get(key) ?? 0;
      items.push({ key, label, className: monthColorClasses[idx % monthColorClasses.length] });
    }
    return items;
  }, [filteredAndSortedTransactions, monthIndexMap]);

  const totalPurchasePriceDisplay = (watchedValues.quantity || 0) * (watchedValues.purchasePrice || 0);
  const totalSellingPriceDisplay = (watchedValues.sellingPrice || 0) > 0 ? (watchedValues.quantity || 0) * (watchedValues.sellingPrice || 0) : 0;
  const profitDisplay = (watchedValues.sellingPrice || 0) > 0 ? totalSellingPriceDisplay - totalPurchasePriceDisplay - (watchedValues.taxes || 0) : 0;
  const sumFactoryPaymentsDisplay = (watchedValues.factoryPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0) + (watchedValues.amountPaidToFactory || 0);
  const computedQuantityFromPayments = (watchedValues.purchasePrice || 0) > 0 ? (sumFactoryPaymentsDisplay / (watchedValues.purchasePrice || 1)) : 0;
  
  const handleExport = () => {
    const headers = [
      'م',
      'رقم العملية',
      'اسم العميل',
      'التاريخ',
      'اسم المورد',
      'الوصف',
      'الكمية',
      'إجمالي الشراء',
  'رصيد المورد بالمصنع',
      'إجمالي البيع',
      'رصيد العميل',
      'مدفوع للمصنع',
      'المستلم من المورد',
      'المستلم من العميل',
      'صافي الربح',
    ];
    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '';
      const string = String(str);
      if (string.search(/("|,|\n)/g) >= 0) return '"' + string.replace(/"/g, '""') + '"';
      return string;
    };
  // أزيلت مقارنة (فرق سابق)
    const rows = filteredAndSortedTransactions.map((t, idx) => {
      const receivedFromCustomer = typeof t.amountReceivedFromCustomer === 'number' ? t.amountReceivedFromCustomer : 0;
      const totalSales = typeof t.totalSellingPrice === 'number' ? t.totalSellingPrice : 0;
      const receivedFromSupplier = typeof t.amountReceivedFromSupplier === 'number' ? t.amountReceivedFromSupplier : 0;
      const customerBalance = (receivedFromCustomer - totalSales) - receivedFromSupplier;
  const deductedQty = (t.actualQuantityDeducted || 0) + (t.otherQuantityDeducted || 0);
  const totalPurchase = parseFloat(((deductedQty) * (t.purchasePrice || 0)).toFixed(2)); // إجمالي الشراء = قيمة الكمية المخصومة فقط
  // رصيد المورد بالمصنع = المبلغ المتبقي
  const supplierBalanceAtFactory = typeof t.remainingAmount === 'number' ? t.remainingAmount : ((t.remainingQuantity || 0) * (t.purchasePrice || 0));

      // نعيد حساب المدفوع للمصنع حتى لو لم نعد نستخدمه في الرصيد (قد يكون مطلوبًا في الأعمدة الأخرى)
      const listPaid = (t.factoryPayments || []).reduce((s, p) => s + (p.amount || 0), 0);
      const paidToFactory = (typeof t.amountPaidToFactory === 'number' ? t.amountPaidToFactory : 0) + listPaid;
      return [
        idx + 1,
        escapeCSV(t.operationNumber || '-'),
        escapeCSV(t.customerName || '-'),
        format(t.date, 'yyyy-MM-dd'),
        escapeCSV(t.supplierName || '-'),
        escapeCSV(t.description || ''),
        t.quantity,
        totalPurchase,
  supplierBalanceAtFactory,
        totalSales,
        customerBalance,
        paidToFactory,
        receivedFromSupplier,
        receivedFromCustomer,
        t.profit,
      ].join(',');
    });
    // إضافة صف المجاميع في النهاية
    const totalsRow = [
      '', // الفراغ للترقيم
      'الإجمالي',
      '-', // اسم العميل
      '-', // التاريخ
      '-', // المورد
      '-', // الوصف
      totals.totalQuantity.toFixed(2),
      totals.totalDeductedPurchase.toFixed(2),
      totals.totalSupplierBalanceAtFactory.toFixed(2),
      totals.totalSalesSum.toFixed(2),
      totals.totalCustomerBalance.toFixed(2),
      totals.totalPaidToFactorySum.toFixed(2),
      totals.totalReceivedFromSupplierSum.toFixed(2),
      totals.totalReceivedFromCustomerSum.toFixed(2),
      totals.totalProfitSum.toFixed(2),
    ].join(',');
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent + '\n' + totalsRow], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'transactions-log.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
    <div className="container-fluid">
      <header className="flex items-center justify-between mb-8 pt-8 px-4">
        <h1 className="text-3xl font-bold text-primary">سجل العمليات</h1>
        <div className="flex gap-2">
          <Button onClick={() => handleOpenDialog(null)}><Plus className="ml-2 h-4 w-4" />إضافة عملية</Button>
          <Button variant="outline" onClick={handleExport}><Download className="ml-2 h-4 w-4" />تصدير CSV</Button>
        </div>
      </header>
      
      <Card className="mx-4">
          <CardHeader>
              <CardTitle>فلترة العمليات</CardTitle>
              <div className="flex flex-col md:flex-row gap-2 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="بحث برقم العملية، اسم العميل، الوصف أو اسم المورد..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    
                    <div className="flex items-center gap-2">
                      <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className={cn("w-full md:w-[180px] justify-start text-right font-normal", !startDate && "text-muted-foreground")}>
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP", { locale: ar }) : <span>من تاريخ</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar mode="single" selected={startDate} onSelect={(date) => { setStartDate(date || undefined); setIsStartDatePopoverOpen(false); }} initialFocus />
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
                          <Calendar mode="single" selected={endDate} onSelect={(date) => { setEndDate(date || undefined); setIsEndDatePopoverOpen(false); }} initialFocus />
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
                  {/* Quantity & Details Filters */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="أدنى كمية"
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(e.target.value)}
                      className="text-xs"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="أقصى كمية"
                      value={maxQuantity}
                      onChange={(e) => setMaxQuantity(e.target.value)}
                      className="text-xs"
                    />
                    <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v === 'ALL' ? '' : v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="الصنف" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">كل الأصناف</SelectItem>
                        {categoryOptions.map(c => <SelectItem key={`fc-${c}`} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterVariety} onValueChange={(v) => setFilterVariety(v === 'ALL' ? '' : v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="النوع" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">كل الأنواع</SelectItem>
                        {varietyOptions.map(v => <SelectItem key={`fv-${v}`} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-destructive"
                      onClick={() => { setMinQuantity(''); setMaxQuantity(''); setFilterCategory(''); setFilterVariety(''); }}
                    >مسح فلاتر الكمية</Button>
                  </div>
                  {/* Selection toolbar */}
                  <div className="flex flex-wrap items-center gap-2 text-xs mt-2 md:mt-0">
                    <Button type="button" variant={hoverSelectMode ? 'secondary' : 'outline'} size="sm" onClick={() => setHoverSelectMode(m => !m)}>
                      {hoverSelectMode ? 'إيقاف تحديد بالمرور' : 'تحديد بالمرور'}
                    </Button>
                    {selectedRowIds.size > 0 && (
                      <>
                        <span className="px-2 py-1 rounded bg-muted">المحدد: {selectedRowIds.size}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={clearSelection} className="text-destructive">مسح التحديد</Button>
                      </>
                    )}
                  </div>
              </div>
              {monthLegend.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 text-xs">
                  {monthLegend.map(m => (
                    <div key={m.key} className="flex items-center gap-1">
                      <span className={cn('inline-block w-4 h-4 rounded border', m.className)} />
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* إجمالي المستلم من العميل (حسب الفلترة الحالية) */}
              <div className="mt-4 text-sm">
                <div className="flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-success/15 text-success font-medium" title="إجمالي المبالغ المستلمة من العملاء حسب الفلترة الحالية">
                    <Wallet className="h-4 w-4" />
                    <span>إجمالي المستلم من العميل:</span>
                    <span>{totals.totalReceivedFromCustomerSum.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span>
                  </div>
                  <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded font-medium', (totals.workingCapital || 0) < 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary')} title="رأس المال الدائر = المبلغ المتبقي + إجمالي رصيد العميل">
                    <span>رأس المال الدائر:</span>
                    <span>{(totals.workingCapital || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span>
                  </div>
                </div>
              </div>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky right-0 bg-card z-30">م</TableHead>
                  <TableHead>رقم العملية</TableHead>
                  <TableHead>اسم العميل</TableHead>
                  <TableHead>التاريخ</TableHead>
                  
                  <TableHead>اسم المورد</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>المنطقة</TableHead>
                  <TableHead>الكمية / التفاصيل</TableHead>
                  <TableHead>الكمية المخصومة</TableHead>
                  <TableHead>الكمية المتبقية</TableHead>
                  <TableHead>المبلغ المتبقي</TableHead>
                  <TableHead>إجمالي الشراء</TableHead>
                  <TableHead>رصيد المورد بالمصنع</TableHead>
                  <TableHead>إجمالي البيع</TableHead>
                  <TableHead>رصيد العميل</TableHead>
                  <TableHead>صافي الربح</TableHead>
                  <TableHead>مدفوع للمصنع</TableHead>
                  <TableHead>الدافع للمصنع</TableHead>
                  <TableHead>ت. دفع المصنع</TableHead>
                  <TableHead>طريقة دفع المصنع</TableHead>
                  <TableHead>المستلم من المورد</TableHead>
                  <TableHead>ت الاستلام من المورد</TableHead>
                  <TableHead>طريقة الاستلام</TableHead>
                  <TableHead>المستلم من العميل</TableHead>
                  <TableHead>ت الاستلام من العميل</TableHead>
                  <TableHead>طريقة الاستلام</TableHead>
                  <TableHead>الناقل</TableHead>
                  <TableHead>هاتف الناقل</TableHead>
                  <TableHead>تاريخ الخروج</TableHead>
                  <TableHead>المرفقات</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {filteredAndSortedTransactions.map((t, index) => {
                    const isSelected = selectedRowIds.has(t.id);
                    return (
                      <TableRow
                        key={t.id}
                        onClick={(e) => { e.stopPropagation(); toggleRowSelection(t.id); }}
                        onMouseEnter={() => { if (hoverSelectMode) addRowSelection(t.id); }}
                        data-state={isSelected ? 'selected' : 'unselected'}
                        className={cn(getRowColorClass(t), 'hover:brightness-95 cursor-pointer', isSelected && 'ring-2 ring-emerald-400')}
                      >
                        <TableCell className={cn('sticky right-0 z-20', getRowColorClass(t), isSelected && 'ring-2 ring-emerald-400')}>{filteredAndSortedTransactions.length - index}</TableCell>
                      <TableCell>{t.operationNumber || '-'}</TableCell>
                      <TableCell>{t.customerName || '-'}</TableCell>
                      <TableCell>{format(t.date, 'dd-MM-yy')}</TableCell>
                      
                      <TableCell>{t.supplierName}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell>{t.governorate || '-'}{t.city ? ` - ${t.city}` : ''}</TableCell>
                      <TableCell>{t.quantity} طن {t.variety ? `/ ${t.variety}` : ''} {t.category ? `/ ${t.category}` : ''}</TableCell>
                      <TableCell className="text-orange-600 font-medium">{(((t.actualQuantityDeducted || 0) + (t.otherQuantityDeducted || 0))).toFixed(2)} طن</TableCell>
                      <TableCell className="text-blue-600 font-medium">{(t.remainingQuantity || 0).toFixed(2)} طن</TableCell>
                      <TableCell className="text-green-600 font-medium">{(t.remainingAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      {(() => {
                        const deductedQty = (t.actualQuantityDeducted || 0) + (t.otherQuantityDeducted || 0);
                        const deductedPurchaseAmount = (deductedQty) * (t.purchasePrice || 0);
                        return (
                          <TableCell title={`الكمية المخصومة × سعر الشراء (${deductedQty.toFixed(2)} × ${(t.purchasePrice || 0).toFixed(2)})`}>
                            {deductedPurchaseAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                          </TableCell>
                        );
                      })()}
                      {(() => {
                        const totalPurchase = typeof t.totalPurchasePrice === 'number' ? t.totalPurchasePrice : 0;
                        const listPaid = (t.factoryPayments || []).reduce((s, p) => s + (p.amount || 0), 0);
                        const paidToFactory = (typeof t.amountPaidToFactory === 'number' ? t.amountPaidToFactory : 0) + listPaid;
                        // تعديل نهائي: رصيد المورد بالمصنع = المبلغ المتبقي (remainingAmount)
                        const supplierBalanceAtFactory = typeof t.remainingAmount === 'number' ? t.remainingAmount : ((t.remainingQuantity || 0) * (t.purchasePrice || 0));
                        ;(t as any)._supplierBalanceAtFactory = supplierBalanceAtFactory;
                        return (
                          <TableCell className={supplierBalanceAtFactory > 0 ? 'text-green-600 font-medium' : supplierBalanceAtFactory < 0 ? 'text-red-600 font-medium' : ''}>
                            {supplierBalanceAtFactory.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                          </TableCell>
                        );
                      })()}
                      {/* أزيل عمود (فرق سابق) */}
                      <TableCell>{t.totalSellingPrice > 0 ? t.totalSellingPrice.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : '-'}</TableCell>
                      <TableCell>
                        {(() => {
                          const receivedFromCustomer = typeof t.amountReceivedFromCustomer === 'number' ? t.amountReceivedFromCustomer : 0;
                          const totalSales = typeof t.totalSellingPrice === 'number' ? t.totalSellingPrice : 0;
                          const receivedFromSupplier = typeof t.amountReceivedFromSupplier === 'number' ? t.amountReceivedFromSupplier : 0;
                          const balance = (receivedFromCustomer - totalSales) - receivedFromSupplier;
                          const cls = balance < 0 ? 'text-red-600 font-medium' : balance > 0 ? 'text-green-600 font-medium' : '';
                          return (
                            <span className={cls} title={`المعادلة: المستلم من العميل (${receivedFromCustomer.toFixed(2)}) - إجمالي البيع (${totalSales.toFixed(2)}) - المستلم من المورد (${receivedFromSupplier.toFixed(2)}) = ${balance.toFixed(2)}`}>
                              {balance.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className={t.profit >= 0 ? 'text-success' : 'text-destructive'}>{t.profit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>
                        {(() => {
                          const listPaid = (t.factoryPayments || []).reduce((s, p) => s + (p.amount || 0), 0);
                          const paidToFactory = (typeof t.amountPaidToFactory === 'number' ? t.amountPaidToFactory : 0) + listPaid;
                          return paidToFactory.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' });
                        })()}
                      </TableCell>
                      <TableCell>{t.paidBy || '-'}</TableCell>
                      <TableCell>{t.datePaidToFactory ? format(t.datePaidToFactory, 'dd-MM-yy') : '-'}</TableCell>
                      <TableCell>
                        {t.paymentMethodToFactory === 'نقدي' && '💵 نقدي'}
                        {t.paymentMethodToFactory === 'تحويل بنكي' && '🏦 تحويل بنكي'}
                        {t.paymentMethodToFactory === 'إيداع' && '💳 إيداع'}
                        {!t.paymentMethodToFactory && '-'}
                      </TableCell>
                      <TableCell>{t.amountReceivedFromSupplier.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                      <TableCell>{t.dateReceivedFromSupplier ? format(t.dateReceivedFromSupplier, 'dd-MM-yy') : '-'}</TableCell>
                      <TableCell>
                        {t.paymentMethodFromSupplier === 'نقدي' && '💵 نقدي'}
                        {t.paymentMethodFromSupplier === 'تحويل بنكي' && '🏦 تحويل بنكي'}
                        {t.paymentMethodFromSupplier === 'إيداع' && '💳 إيداع'}
                        {!t.paymentMethodFromSupplier && '-'}
                      </TableCell>
                      <TableCell>
                        {typeof t.amountReceivedFromCustomer === 'number' && t.amountReceivedFromCustomer > 0
                          ? t.amountReceivedFromCustomer.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {t.dateReceivedFromCustomer ? format(t.dateReceivedFromCustomer, 'dd-MM-yy') : '-'}
                      </TableCell>
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
                      <TableCell className="max-w-[150px] truncate" title={t.notes}>{t.notes || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(t)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="تقرير العملية" onClick={() => handleOpenOperationReport(t)}>
                            <LineChart className="h-4 w-4 text-emerald-600" />
                          </Button>
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
                    );
                  })}
                </TableBody>
                {/* صف الإجماليات */}
                <tfoot>
                  <tr className="font-bold bg-muted/50">
                    <td className="sticky right-0 bg-muted/50 z-20"></td>
                    <td>الإجمالي</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>{totals.totalQuantity.toFixed(2)} طن</td>
                    <td>{totals.totalDeductedQuantity.toFixed(2)} طن</td>
                    <td>{totals.totalRemainingQuantity.toFixed(2)} طن</td>
                    <td>{totals.totalRemainingAmount.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td>{totals.totalDeductedPurchase.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td>{totals.totalSupplierBalanceAtFactory.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td>{totals.totalSalesSum.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td className={totals.totalCustomerBalance < 0 ? 'text-red-600' : totals.totalCustomerBalance > 0 ? 'text-green-600' : ''}>{totals.totalCustomerBalance.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td className={totals.totalProfitSum < 0 ? 'text-destructive' : 'text-success'}>{totals.totalProfitSum.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td>{totals.totalPaidToFactorySum.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>{totals.totalReceivedFromSupplierSum.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td></td>
                    <td></td>
                    <td>{totals.totalReceivedFromCustomerSum.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
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
                          <FormField control={form.control} name="operationKey" render={({ field }) => (
                            <FormItem>
                              <FormLabel>مفتاح العملية (سائب) <span className="text-xs text-muted-foreground">مثال: 42.5/اسم العميل</span></FormLabel>
                              <FormControl><Input placeholder="مثال: 42.5/ناصر عراقى" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>اسم العميل (اختياري)</FormLabel>
                                <FormControl>
                                  <div className="space-y-1">
                                    <Input
                                      placeholder="اكتب أو اختر اسم العميل"
                                      list="customer-names"
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value)}
                                    />
                                    <datalist id="customer-names">
                                      {customerNames.map(name => (
                                        <option key={name} value={name} />
                                      ))}
                                    </datalist>
                                    <p className="text-[10px] text-muted-foreground">يمكنك كتابة اسم جديد وسيتم حفظه تلقائيًا عند حفظ العملية.</p>
                                  </div>
                                </FormControl>
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
                        <div className="space-y-4 pt-4">
                          {/* دفعة للمصنع */}
                          <div className="p-3 border rounded-lg space-y-3">
                            <h4 className="font-medium text-sm">دفعة للمصنع</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={form.control} name="amountPaidToFactory" render={({ field }) => (<FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                               <FormField control={form.control} name="paidBy" render={({ field }) => (
                                <FormItem><FormLabel>من (الدافع)</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="اختر الدافع" /></SelectTrigger></FormControl>
                                    <SelectContent>{allEntities.map((name) => (<SelectItem key={`paidBy-${name}`} value={name}>{name}</SelectItem>))}</SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <FormField control={form.control} name="paymentMethodToFactory" render={({ field }) => (<FormItem><FormLabel>طريقة الدفع</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger></FormControl><SelectContent><SelectItem value="نقدي">نقدي</SelectItem><SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem><SelectItem value="إيداع">إيداع</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                               <FormField control={form.control} name="datePaidToFactory" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>تاريخ الدفع للمصنع</FormLabel><Popover modal={false} open={isDatePaidToFactoryPopoverOpen} onOpenChange={setIsDatePaidToFactoryPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date || undefined); setIsDatePaidToFactoryPopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                              )} />
                             </div>

                             {/* دفعات إضافية للمصنع */}
                             <div className="mt-4 space-y-2">
                               <div className="flex items-center justify-between">
                                 <h5 className="text-sm font-medium">دفعات إضافية</h5>
                                 <Button type="button" variant="outline" size="sm" onClick={() => {
                                   const current = [...(watchedValues.factoryPayments || [])];
                                   current.push({ amount: 0, paidBy: '', date: undefined, method: undefined });
                                   setValue('factoryPayments', current as any, { shouldDirty: true });
                                 }}>إضافة دفعة</Button>
                               </div>
                               {(watchedValues.factoryPayments || []).length > 0 && (
                                 <div className="space-y-3">
                                   {(watchedValues.factoryPayments || []).map((p, idx) => (
                                     <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                                       <div>
                                         <Label>المبلغ</Label>
                                         <Input type="number" value={p.amount ?? 0} onChange={(e) => {
                                           const v = parseFloat(e.target.value || '0');
                                           const arr = [...(watchedValues.factoryPayments || [])];
                                           arr[idx] = { ...arr[idx], amount: isNaN(v) ? 0 : v };
                                           setValue('factoryPayments', arr as any, { shouldDirty: true });
                                         }} />
                                       </div>
                                       <div>
                                         <Label>الدافع</Label>
                                         <Select value={p.paidBy || ''} onValueChange={(val) => {
                                           const arr = [...(watchedValues.factoryPayments || [])];
                                           arr[idx] = { ...arr[idx], paidBy: val };
                                           setValue('factoryPayments', arr as any, { shouldDirty: true });
                                         }}>
                                           <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                                           <SelectContent>{allEntities.map(n => (<SelectItem key={`fp-${idx}-${n}`} value={n}>{n}</SelectItem>))}</SelectContent>
                                         </Select>
                                       </div>
                                       <div>
                                         <Label>الطريقة</Label>
                                         <Select value={p.method || undefined} onValueChange={(val) => {
                                           const arr = [...(watchedValues.factoryPayments || [])];
                                           arr[idx] = { ...arr[idx], method: val as any };
                                           setValue('factoryPayments', arr as any, { shouldDirty: true });
                                         }}>
                                           <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                                           <SelectContent>
                                             <SelectItem value="نقدي">نقدي</SelectItem>
                                             <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                                             <SelectItem value="إيداع">إيداع</SelectItem>
                                           </SelectContent>
                                         </Select>
                                       </div>
                                       <div className="flex flex-col">
                                         <Label>التاريخ</Label>
                                         <Popover modal={false} open={!!factoryPaymentDatePopoverOpen[idx]} onOpenChange={(open) => setFactoryPaymentDatePopoverOpen(prev => ({ ...prev, [idx]: open }))}>
                                           <PopoverTrigger asChild>
                                             <Button variant="outline" className={cn("w-full justify-start text-right font-normal", !p.date && "text-muted-foreground")}>
                                               <CalendarIcon className="ml-2 h-4 w-4" />{p.date ? format(p.date, 'PPP', { locale: ar }) : <span>اختر تاريخ</span>}
                                             </Button>
                                           </PopoverTrigger>
                                           <PopoverContent className="w-auto p-0" align="center">
                                             <Calendar mode="single" selected={p.date} onSelect={(date) => {
                                               const arr = [...(watchedValues.factoryPayments || [])];
                                               arr[idx] = { ...arr[idx], date: date || undefined };
                                               setValue('factoryPayments', arr as any, { shouldDirty: true });
                                               setFactoryPaymentDatePopoverOpen(prev => ({ ...prev, [idx]: false }));
                                             }} initialFocus />
                                           </PopoverContent>
                                         </Popover>
                                       </div>
                                       <div className="flex items-center gap-2">
                                         <Button type="button" variant="ghost" className="text-red-600" onClick={() => {
                                           const arr = [...(watchedValues.factoryPayments || [])];
                                           arr.splice(idx, 1);
                                           setValue('factoryPayments', arr as any, { shouldDirty: true });
                                         }}>
                                           <Trash2 className="h-4 w-4" />
                                         </Button>
                                       </div>
                                     </div>
                                   ))}
                                   <div className="text-xs text-muted-foreground">إجمالي دفعات المصنع: {sumFactoryPaymentsDisplay.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</div>
                                   <div className="flex items-center gap-2 text-xs">
                                     <span>كمية محسوبة من الدفعات وسعر الشراء: <b>{computedQuantityFromPayments.toFixed(3)} طن</b></span>
                                     <Button type="button" size="sm" variant="secondary" onClick={() => setValue('quantity', Number.isFinite(computedQuantityFromPayments) ? parseFloat(computedQuantityFromPayments.toFixed(3)) : 0, { shouldDirty: true })}>اعتماد الكمية</Button>
                                   </div>
                                 </div>
                               )}
                             </div>
                          </div>
                          
                          {/* دفعة من المورد */}
                          <div className="p-3 border rounded-lg space-y-3">
                            <h4 className="font-medium text-sm">دفعة من المورد</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={form.control} name="amountReceivedFromSupplier" render={({ field }) => (<FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name="receivedBy" render={({ field }) => (
                <FormItem><FormLabel>العميل (المستلم)</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger></FormControl>
                  <SelectContent>{customerNames.map((name) => (<SelectItem key={`receivedBy-${name}`} value={name}>{name}</SelectItem>))}</SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={form.control} name="paymentMethodFromSupplier" render={({ field }) => (<FormItem><FormLabel>طريقة الاستلام</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر طريقة الاستلام" /></SelectTrigger></FormControl><SelectContent><SelectItem value="نقدي">نقدي</SelectItem><SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem><SelectItem value="إيداع">إيداع</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name="dateReceivedFromSupplier" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>تاريخ الاستلام من المورد</FormLabel><Popover modal={false} open={isDateReceivedFromSupplierPopoverOpen} onOpenChange={setIsDateReceivedFromSupplierPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date || undefined); setIsDateReceivedFromSupplierPopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                              )} />
                            </div>
                          </div>

                          {/* دفعة من العميل */}
                          <div className="p-3 border rounded-lg space-y-3">
                            <h4 className="font-medium text-sm">دفعة من العميل</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="amountReceivedFromCustomer" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>المبلغ</FormLabel>
                                    <FormControl>
                                      <Input type="number" placeholder="0" {...field} onChange={(e) => { setCustomerAmountManuallyEdited(true); field.onChange(e); }} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="customerPaymentReceivedBy" render={({ field }) => (
                                  <FormItem><FormLabel>المورد (المستلم)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger></FormControl>
                                      <SelectContent>{supplierNames.map((name) => (<SelectItem key={`custPayRcvdBy-${name}`} value={name}>{name}</SelectItem>))}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={form.control} name="paymentMethodFromCustomer" render={({ field }) => (<FormItem><FormLabel>طريقة الاستلام</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر طريقة الاستلام" /></SelectTrigger></FormControl><SelectContent><SelectItem value="نقدي">نقدي</SelectItem><SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem><SelectItem value="إيداع">إيداع</SelectItem><SelectItem value="شيك">شيك</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name="dateReceivedFromCustomer" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>تاريخ الاستلام من العميل</FormLabel><Popover modal={false} open={isDateReceivedPopoverOpen} onOpenChange={setIsDateReceivedPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date || undefined); setIsDateReceivedPopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                              )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                              <div>المقترح لهذه الدفعة: <b className="text-foreground">{(((watchedValues.actualQuantityDeducted || 0) + (watchedValues.otherQuantityDeducted || 0)) * (watchedValues.sellingPrice || 0)).toFixed(2)}</b></div>
                              <div>المستلم سابقاً لنفس المفتاح: <b className="text-foreground">{opReceivedFromCustomerOther.toFixed(2)}</b></div>
                              <div>المتبقي لنفس المفتاح (بعد هذه الدفعة): <b className="text-foreground">{Math.max(0, (((opDeductedQtyOther + ((watchedValues.actualQuantityDeducted || 0) + (watchedValues.otherQuantityDeducted || 0))) * (watchedValues.sellingPrice || 0)) - opReceivedFromCustomerOther - (watchedValues.amountReceivedFromCustomer || 0))).toFixed(2)}</b></div>
                            </div>
                            <div className="mt-2">
                              {!customerAmountManuallyEdited && (
                                <div className="text-xs">المبلغ يتم حسابه تلقائياً من الكمية المخصومة × سعر البيع. يمكنك التعديل يدويًا إذا لزم.</div>
                              )}
                              {customerAmountManuallyEdited && (
                                <Button type="button" size="sm" variant="secondary" onClick={() => { setCustomerAmountManuallyEdited(false); }}>
                                  العودة للحساب التلقائي
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* دفعات متعددة من العميل */}
                          <div className="p-3 border rounded-lg space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-medium text-sm">دفعات من العميل (متعددة)</h4>
                              <div className="flex items-center gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => {
                                  const current = [...(watchedValues.customerPayments || [])];
                                  current.push({ amount: 0, date: undefined, method: undefined, receivedBy: '', notes: '' });
                                  setValue('customerPayments', current as any, { shouldDirty: true });
                                }}>إضافة دفعة</Button>
                                <Button type="button" size="sm" variant="secondary" onClick={() => {
                                  const cps = [...(watchedValues.customerPayments || [])];
                                  const notApplied = cps.filter(p => !p.applied);
                                  if (notApplied.length === 0) return;
                                  const total = notApplied.reduce((s, p) => s + (p.amount || 0), 0);
                                  if (total <= 0) return;
                                  const currentMain = Number(watchedValues.amountReceivedFromCustomer) || 0;
                                  const newTotal = parseFloat((currentMain + total).toFixed(2));
                                  setValue('amountReceivedFromCustomer', newTotal, { shouldDirty: true });
                                  setCustomerAmountManuallyEdited(true);
                                  // تحديث الحقول المساعدة إذا موحدة في الدفعات غير المعتمدة فقط
                                  const uniqueMethods = Array.from(new Set(notApplied.map(p => p.method).filter(Boolean)));
                                  if (uniqueMethods.length === 1 && !watchedValues.paymentMethodFromCustomer) setValue('paymentMethodFromCustomer', uniqueMethods[0] as any, { shouldDirty: true });
                                  const uniqueReceivedBy = Array.from(new Set(notApplied.map(p => p.receivedBy).filter(Boolean)));
                                  if (uniqueReceivedBy.length === 1 && !watchedValues.customerPaymentReceivedBy) setValue('customerPaymentReceivedBy', uniqueReceivedBy[0] as any, { shouldDirty: true });
                                  const uniqueDates = Array.from(new Set(notApplied.map(p => p.date instanceof Date && !isNaN(p.date.getTime()) ? p.date.getTime() : null).filter(Boolean)));
                                  if (uniqueDates.length === 1 && !watchedValues.dateReceivedFromCustomer) {
                                    const onlyDate = notApplied.find(p => p.date instanceof Date && p.date.getTime() === uniqueDates[0])?.date;
                                    if (onlyDate) setValue('dateReceivedFromCustomer', onlyDate as any, { shouldDirty: true });
                                  }
                                  // وسم الجميع كمعتمد
                                  const updated = cps.map(p => p.applied ? p : { ...p, applied: true });
                                  setValue('customerPayments', updated as any, { shouldDirty: true });
                                }}
                                disabled={!(watchedValues.customerPayments || []).some(p => !p.applied)}
                                >اعتماد الكل</Button>
                              </div>
                            </div>
                            {(watchedValues.customerPayments || []).length === 0 && (
                              <p className="text-xs text-muted-foreground">لا توجد دفعات مضافة. اضغط (إضافة دفعة).</p>
                            )}
                            {(watchedValues.customerPayments || []).length > 0 && (
                              <div className="space-y-3">
                                {(watchedValues.customerPayments || []).map((cp, idx) => (
                                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border p-2 rounded">
                                    <div>
                                      <Label>المبلغ</Label>
                                      <Input type="number" value={cp.amount ?? 0} onChange={(e) => {
                                        const v = parseFloat(e.target.value || '0');
                                        const arr = [...(watchedValues.customerPayments || [])];
                                        arr[idx] = { ...arr[idx], amount: isNaN(v) ? 0 : v };
                                        setValue('customerPayments', arr as any, { shouldDirty: true });
                                      }} />
                                    </div>
                                    <div>
                                      <Label>الطريقة</Label>
                                      <Select value={cp.method || undefined} onValueChange={(val) => {
                                        const arr = [...(watchedValues.customerPayments || [])];
                                        arr[idx] = { ...arr[idx], method: val as any };
                                        setValue('customerPayments', arr as any, { shouldDirty: true });
                                      }}>
                                        <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="نقدي">نقدي</SelectItem>
                                          <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                                          <SelectItem value="إيداع">إيداع</SelectItem>
                                          <SelectItem value="شيك">شيك</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>التاريخ</Label>
                                      <Button type="button" variant="outline" className={cn('w-full justify-start', !cp.date && 'text-muted-foreground')} onClick={() => {
                                        const arr = [...(watchedValues.customerPayments || [])];
                                        arr[idx] = { ...arr[idx], date: cp.date ? undefined : new Date() };
                                        setValue('customerPayments', arr as any, { shouldDirty: true });
                                      }}>{cp.date && cp.date instanceof Date && !isNaN(cp.date.getTime()) ? format(cp.date, 'yyyy-MM-dd') : 'اليوم'}</Button>
                                    </div>
                                    <div>
                                      <Label>المستلم</Label>
                                      <Input value={cp.receivedBy || ''} onChange={(e) => {
                                        const arr = [...(watchedValues.customerPayments || [])];
                                        arr[idx] = { ...arr[idx], receivedBy: e.target.value };
                                        setValue('customerPayments', arr as any, { shouldDirty: true });
                                      }} />
                                    </div>
                                    <div className="flex items-end gap-1">
                                      <Button type="button" size="sm" variant="secondary" disabled={cp.applied} onClick={() => {
                                        if (cp.applied) return; // حماية إضافية
                                        const amt = parseFloat((cp.amount || 0).toFixed(2));
                                        if (amt <= 0) return;
                                        const currentMain = Number(watchedValues.amountReceivedFromCustomer) || 0;
                                        setValue('amountReceivedFromCustomer', parseFloat((currentMain + amt).toFixed(2)), { shouldDirty: true });
                                        if (cp.method && !watchedValues.paymentMethodFromCustomer) setValue('paymentMethodFromCustomer', cp.method as any, { shouldDirty: true });
                                        if (cp.date && !watchedValues.dateReceivedFromCustomer) setValue('dateReceivedFromCustomer', cp.date as any, { shouldDirty: true });
                                        if (cp.receivedBy && !watchedValues.customerPaymentReceivedBy) setValue('customerPaymentReceivedBy', cp.receivedBy as any, { shouldDirty: true });
                                        setCustomerAmountManuallyEdited(true);
                                        // وسم الصف كمعتمد
                                        const arr = [...(watchedValues.customerPayments || [])];
                                        arr[idx] = { ...arr[idx], applied: true };
                                        setValue('customerPayments', arr as any, { shouldDirty: true });
                                      }}>اعتماد</Button>
                                      <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => {
                                        const arr = [...(watchedValues.customerPayments || [])];
                                        arr.splice(idx, 1);
                                        setValue('customerPayments', arr as any, { shouldDirty: true });
                                      }}>حذف</Button>
                                    </div>
                                    <div className="md:col-span-6">
                                      <Label>ملاحظات</Label>
                                      <Input value={cp.notes || ''} onChange={(e) => {
                                        const arr = [...(watchedValues.customerPayments || [])];
                                        arr[idx] = { ...arr[idx], notes: e.target.value };
                                        setValue('customerPayments', arr as any, { shouldDirty: true });
                                      }} />
                                    </div>
                                  </div>
                                ))}
                                <div className="text-xs text-muted-foreground flex justify-between">
                                  <span>إجمالي دفعات العميل: {(watchedValues.customerPayments || []).reduce((s, p) => s + (p.amount || 0), 0).toFixed(2)}</span>
                                  <span className="font-medium">يُدمج الإجمالي تلقائياً في (دفعة من العميل) إذا لم تُعدل يدويًا</span>
                                </div>
                              </div>
                            )}
                          </div>

                          
                          <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem className="mt-4">
                                <FormLabel>ملاحظات (اختياري)</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="أضف أي ملاحظات أو تفاصيل إضافية هنا..."
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
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
                            <FormItem className="flex flex-col"><FormLabel>تاريخ الخروج</FormLabel><Popover modal={false} open={isDepartureDatePopoverOpen} onOpenChange={setIsDepartureDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ الخروج</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date || undefined); setIsDepartureDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
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
                            <FormItem className="flex flex-col"><FormLabel>تاريخ العملية (تخزين)</FormLabel><Popover modal={false} open={isTransactionDatePopoverOpen} onOpenChange={setIsTransactionDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date || undefined); setIsTransactionDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="actualQuantityDeducted" render={({ field }) => (
                            <FormItem>
                              <FormLabel>الكمية الفعلية المخصومة</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="0" {...field} onChange={(e) => { field.onChange(e); setLastEditedDeductField('actual'); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="otherQuantityDeducted" render={({ field }) => (
                            <FormItem>
                              <FormLabel>الكمية المخصومة الأخرى</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="0" {...field} onChange={(e) => { field.onChange(e); setLastEditedDeductField('other'); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-xs text-muted-foreground">
                          <div>إجمالي الكمية لهذا المفتاح: <b className="text-foreground">{totalAssignedForKey.toFixed(3)}</b> طن</div>
                          <div>المخصوم سابقاً: <b className="text-foreground">{opDeductedQtyOther.toFixed(3)}</b> طن</div>
                          <div>المتبقي قبل هذا الإدخال: <b className="text-foreground">{Math.max(0, remainingQtyForKeyBeforeCurrent).toFixed(3)}</b> طن</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                           <FormItem>
                             <Label>الكمية المتبقية</Label>
                             <Input 
                               type="number" 
                               value={remainingQtyForKeyAfterCurrent.toFixed(2)} 
                               readOnly 
                               className="font-bold bg-blue-50" 
                             />
                           </FormItem>
                           <FormItem>
                             <Label>المبلغ المتبقي</Label>
                             <Input 
                               type="number" 
                               value={(remainingQtyForKeyAfterCurrent * (watchedValues.purchasePrice || 0)).toFixed(2)} 
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
                    {!editingTransaction && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting || isSubmittingWithPayment || isUploadingAttachments}
                        onClick={() => form.handleSubmit(onSubmitAndCreatePayment)()}
                      >
                        {isSubmittingWithPayment
                          ? 'جاري الحفظ + الدفعة...'
                          : 'حفظ + إضافة دفعة'}
                      </Button>
                    )}
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
      {/* Operation Report Dialog */}
      <Dialog open={isOpReportOpen} onOpenChange={setIsOpReportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>تقرير العملية</DialogTitle>
            <DialogDescription>تفاصيل الحركة والكميات والماليات للعملية المختارة</DialogDescription>
          </DialogHeader>
          {reportTx && (
            <div className="space-y-4 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>رقم العملية</Label><div className="font-medium">{reportTx.operationNumber || '-'}</div></div>
                <div><Label>مفتاح العملية</Label><div className="font-medium">{reportTx.operationKey || '-'}</div></div>
                <div><Label>المورد</Label><div className="font-medium">{reportTx.supplierName}</div></div>
                <div><Label>العميل</Label><div className="font-medium">{reportTx.customerName || '-'}</div></div>
                <div><Label>الصنف/النوع</Label><div className="font-medium">{reportTx.category || '-'} {reportTx.variety ? `/ ${reportTx.variety}` : ''}</div></div>
                <div><Label>الكمية</Label><div className="font-medium">{reportTx.quantity} طن</div></div>
              </div>
              <div className="p-3 border rounded">
                <h4 className="font-medium mb-2">حركة الكمية</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>الكمية المخصومة الفعلية: <b>{(reportTx.actualQuantityDeducted || 0).toFixed(2)}</b> طن</div>
                  <div>الكمية المخصومة الأخرى: <b>{(reportTx.otherQuantityDeducted || 0).toFixed(2)}</b> طن</div>
                  <div>الكمية المتبقية: <b>{(reportTx.remainingQuantity || 0).toFixed(2)}</b> طن</div>
                  <div>المبلغ المتبقي: <b>{(reportTx.remainingAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</b></div>
                </div>
              </div>
              <div className="p-3 border rounded">
                <h4 className="font-medium mb-2">الحركة المالية</h4>
                <div className="text-sm space-y-1">
                  {(() => {
                    const deductedQty = (reportTx.actualQuantityDeducted || 0) + (reportTx.otherQuantityDeducted || 0);
                    const deductedPurchaseAmount = (deductedQty) * (reportTx.purchasePrice || 0);
                    return (
                      <div>إجمالي الشراء (المخصوم فقط): <b>{deductedPurchaseAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</b></div>
                    );
                  })()}
                  <div>مدفوع للمصنع: <b>{(reportTx.amountPaidToFactory || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</b></div>
                  {(reportTx.factoryPayments && reportTx.factoryPayments.length > 0) && (
                    <div className="mt-2">
                      <div className="font-medium mb-1">تفصيل دفعات المصنع:</div>
                      <ul className="list-disc pr-6 space-y-1">
                        {reportTx.factoryPayments.map((p, i) => (
                          <li key={i}>
                            {p.date ? format(p.date, 'yyyy-MM-dd') : '-'} — {p.amount?.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })} — {p.method || '-'} — {p.paidBy || '-'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>إجمالي البيع: <b>{(reportTx.totalSellingPrice || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</b></div>
                  <div>المستلم من المورد: <b>{(reportTx.amountReceivedFromSupplier || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</b></div>
                  <div>المستلم من العميل: <b>{(reportTx.amountReceivedFromCustomer || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</b></div>
                  <div>صافي الربح: <b className={reportTx.profit >= 0 ? 'text-green-700' : 'text-red-700'}>{(reportTx.profit || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</b></div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">إغلاق</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Preview Attachment Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={(open) => { if (!open) { setIsPreviewOpen(false); } }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>معاينة المرفقات</DialogTitle>
            <DialogDescription>
              تصفح المرفقات (عدد: {previewAttachments?.length || 0})
            </DialogDescription>
          </DialogHeader>
          {previewAttachments && previewAttachments.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium truncate flex-1" title={previewAttachments[currentPreviewIndex]?.name}>
                  {previewAttachments[currentPreviewIndex]?.name}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handlePreviousAttachment}>السابق</Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleNextAttachment}>التالي</Button>
                  {previewAttachments[currentPreviewIndex]?.url && (
                    <a
                      href={previewAttachments[currentPreviewIndex]?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-blue-600"
                    >فتح في تبويب</a>
                  )}
                </div>
              </div>
              <div className="border rounded-lg p-3 bg-muted relative">
                {(() => {
                  const att = previewAttachments[currentPreviewIndex];
                  if (!att) return null;
                  if (att.type === 'image') {
                    return (
                      <div className="flex flex-col items-center">
                        {imageLoading && <div className="text-xs mb-2">جاري التحميل...</div>}
                        {imageLoadError && <div className="text-xs text-red-600 mb-2">حدث خطأ في تحميل الصورة. <Button size="sm" variant="secondary" onClick={() => { setImageLoadError(false); setRetryCount(r => r + 1); setImageLoading(true); }}>إعادة المحاولة</Button></div>}
                        <img
                          key={att.url + retryCount}
                          src={att.url}
                          className="max-h-[65vh] object-contain rounded shadow"
                          onLoad={() => { setImageLoading(false); setImageLoadError(false); }}
                          onError={() => { setImageLoading(false); setImageLoadError(true); }}
                          alt={att.name}
                        />
                      </div>
                    );
                  }
                  if (att.type === 'pdf') {
                    return (
                      <iframe
                        src={att.url + '#toolbar=0'}
                        className="w-full h-[70vh] rounded bg-white"
                      />
                    );
                  }
                  return (
                    <div className="text-center text-sm">
                      نوع الملف غير مدعوم للمعاينة المباشرة. يمكنك تنزيله:
                      <div className="mt-2">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">تنزيل / فتح</a>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>({currentPreviewIndex + 1} / {previewAttachments.length})</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      // trigger replace file flow
                      const input = document.getElementById('replace-file-input') as HTMLInputElement | null;
                      input?.click();
                    }}
                  >استبدال</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const att = previewAttachments[currentPreviewIndex];
                      if (att && window.confirm('حذف هذا المرفق؟')) {
                        handleDeleteExistingAttachment(att.id || att.url, att.url);
                      }
                    }}
                  >حذف</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">لا توجد مرفقات للعرض</div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">إغلاق</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Hidden file input for replacing attachments */}
      <input id="replace-file-input" type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleReplaceFile} />
    </div>
  );
}

export default function TransactionsLogPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <TransactionsLogPageContent />
    </React.Suspense>
  );
}
