

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
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
import { SidebarTrigger } from './ui/sidebar';
import { Skeleton } from './ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { EditableDropdown } from './ui/editable-dropdown';
import { type PerformanceAnalysisOutput } from '@/ai/flows/analyze-performance-flow';
import { descriptionOptions, categoryOptions, varietyOptions } from '@/data/transaction-data';
import { Textarea } from './ui/textarea';

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
  notes: z.string().optional(),
  
  // طرق الدفع الجديدة
  paymentMethodToFactory: z.enum(['نقدي', 'تحويل بنكي', 'إيداع']).optional(),
  paymentMethodFromSupplier: z.enum(['نقدي', 'تحويل بنكي', 'إيداع']).optional(),
  
  // حقول إدارة المخزون للصنف السائب
  actualQuantityDeducted: z.coerce.number().min(0, 'الكمية الفعلية يجب أن تكون موجبة.').optional(),
  transactionDate: z.date().optional(),
  transactionNumber: z.string().optional(),
  
  // المرفقات - تعامل منفصل عن validation النموذج
  // attachments: handled separately
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const expenseSchema = z.object({
  date: z.date({ required_error: "التاريخ مطلوب." }),
  description: z.string().trim().min(1, "الوصف مطلوب."),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون صفرًا أو أكبر."),
  paymentOrder: z.string().optional(),
  supplierName: z.string().optional(),
  customerName: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;


export default function AccountingDashboard() {
  const { 
    transactions, addTransaction, updateTransaction, deleteTransaction, 
    expenses, addExpense, updateExpense, deleteExpense, 
    loading,
    createCustomerPaymentFromTransaction,
    supplierNames,
    customerNames,
  } = useTransactions();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [dateType, setDateType] = useState<'operation' | 'execution'>('operation');
  const [analysis, setAnalysis] = useState<PerformanceAnalysisOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  
  // Preview states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewAttachments, setPreviewAttachments] = useState<Transaction['attachments']>([]);
  const [previewTransaction, setPreviewTransaction] = useState<Transaction | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // File attachments state
  const [attachments, setAttachments] = useState<Array<{
    id: string;
    name: string;
    file: File;
    type: 'image' | 'pdf' | 'document';
    category: 'factory_payment' | 'supplier_receipt' | 'invoice' | 'other';
    preview?: string;
  }>>([]);
  
  // Popover states
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isExecDatePopoverOpen, setIsExecDatePopoverOpen] = useState(false);
  const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = useState(false);
  const [isTransactionDatePopoverOpen, setIsTransactionDatePopoverOpen] = useState(false);
  const [isExpenseDatePopoverOpen, setIsExpenseDatePopoverOpen] = useState(false);
  const [isFilterDatePopoverOpen, setIsFilterDatePopoverOpen] = useState(false);
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

  // Transaction Form
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
      notes: "",
      // طرق الدفع الجديدة
      paymentMethodToFactory: undefined,
      paymentMethodFromSupplier: undefined,
      // حقول إدارة المخزون الجديدة
      actualQuantityDeducted: 0,
      transactionDate: undefined,
      transactionNumber: ""
    },
  });
  const { watch, setValue } = form;
  const watchedValues = watch();
  const selectedGovernorate = watch("governorate");

  // Expense Form
  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: new Date(), description: "", amount: 0, paymentOrder: "", supplierName: "", customerName: "" },
  });

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
        showExecutionDate: transaction.showExecutionDate ?? false,
        governorate: transaction.governorate || '',
        city: transaction.city || '',
        description: transaction.description || '',
        category: transaction.category || '',
        variety: transaction.variety || '',
        notes: transaction.notes || '',
        paymentMethodToFactory: transaction.paymentMethodToFactory || undefined,
        paymentMethodFromSupplier: transaction.paymentMethodFromSupplier || undefined,
        actualQuantityDeducted: transaction.actualQuantityDeducted || 0,
        transactionNumber: transaction.transactionNumber || ''
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
        notes: "",
        paymentMethodToFactory: undefined,
        paymentMethodFromSupplier: undefined,
        actualQuantityDeducted: 0,
        transactionNumber: ""
      });
    }
    setIsDialogOpen(true);
  };
  
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

  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      setEditingTransaction(null);
      setAttachments([]); // مسح المرفقات عند إغلاق النموذج
    }
    setIsDialogOpen(open);
  };

  // دوال التعامل مع الملفات
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, category: 'factory_payment' | 'supplier_receipt' | 'invoice' | 'other') => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // التحقق من نوع الملف
      const fileType = file.type;
      let type: 'image' | 'pdf' | 'document' = 'document';
      
      if (fileType.startsWith('image/')) {
        type = 'image';
      } else if (fileType === 'application/pdf') {
        type = 'pdf';
      }

      // التحقق من حجم الملف (أقل من 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "خطأ في الملف",
          description: `حجم الملف ${file.name} كبير جداً. يجب أن يكون أقل من 10MB.`,
          variant: "destructive"
        });
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

    // إعادة تعيين قيمة input
    event.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter(a => a.id !== id);
    });
  };

  const uploadAttachmentsToFirebase = async (transactionId: string) => {
    try {
      const uploadPromises = attachments.map(async (attachment, index) => {
        if (!attachment.file) return null;
        
        // تحديث التقدم
        toast({ 
          title: `رفع الملف ${index + 1} من ${attachments.length}`, 
          description: `جاري رفع: ${attachment.name}` 
        });
        
        // إنشاء مرجع للملف في Firebase Storage
        const fileName = `${Date.now()}_${attachment.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `transactions/${transactionId}/${fileName}`);
        
        // رفع الملف
        const snapshot = await uploadBytes(storageRef, attachment.file);
        
        // الحصول على رابط التحميل
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return {
          id: attachment.id,
          name: attachment.name,
          url: downloadURL,
          type: attachment.type,
          uploadDate: new Date(),
          category: attachment.category
        };
      });
      
      const uploadedAttachments = await Promise.all(uploadPromises);
      const successfulUploads = uploadedAttachments.filter((item): item is NonNullable<typeof item> => item !== null);
      
      if (successfulUploads.length > 0) {
        toast({ 
          title: "تم رفع المرفقات بنجاح", 
          description: `تم رفع ${successfulUploads.length} ملف بنجاح` 
        });
      }
      
      return successfulUploads;
    } catch (error) {
      console.error('خطأ في رفع المرفقات:', error);
      toast({
        title: "خطأ في رفع المرفقات",
        description: "حدث خطأ أثناء رفع الملفات. يرجى المحاولة مرة أخرى.",
        variant: "destructive"
      });
      throw error; // إعادة رمي الخطأ ليتم التعامل معه في الدالة المستدعية
    }
  };

  // دالة حذف مرفق من Firebase Storage
  const deleteAttachmentFromFirebase = async (attachmentUrl: string) => {
    try {
      console.log('محاولة حذف الملف:', attachmentUrl);
      
      // إذا كان الرابط يحتوي على رابط Firebase كامل، استخرج المسار فقط
      let filePath = attachmentUrl;
      if (attachmentUrl.includes('firebasestorage.googleapis.com')) {
        // استخراج المسار من الرابط الكامل
        const urlParts = attachmentUrl.split('/o/')[1];
        if (urlParts) {
          filePath = decodeURIComponent(urlParts.split('?')[0]);
        }
      }
      
      console.log('مسار الملف المستخرج:', filePath);
      
      const attachmentRef = ref(storage, filePath);
      await deleteObject(attachmentRef);
      console.log('تم حذف الملف من Firebase Storage بنجاح');
      return true;
    } catch (error: any) {
      console.error('خطأ في حذف المرفق من Firebase:', error);
      console.error('تفاصيل الخطأ:', {
        code: error?.code,
        message: error?.message,
        originalUrl: attachmentUrl
      });
      
      // إذا كان الملف غير موجود، فاعتبر العملية ناجحة
      if (error?.code === 'storage/object-not-found') {
        console.log('الملف غير موجود في Firebase Storage، سيتم إزالته من قاعدة البيانات فقط');
        return true;
      }
      
      // للأخطاء الأخرى، أرجع false
      return false;
    }
  };

  // دالة حذف مرفق من العملية
  const handleDeleteExistingAttachment = async (attachmentId: string, attachmentUrl: string) => {
    const targetTransaction = editingTransaction || previewTransaction;
    if (!targetTransaction) return;

    // تأكيد الحذف
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا المرفق؟ لا يمكن التراجع عن هذا الإجراء.');
    if (!confirmed) return;

    try {
      // حذف من Firebase Storage (سيتم التعامل مع حالة عدم وجود الملف)
      const deleted = await deleteAttachmentFromFirebase(attachmentUrl);
      
      // حتى لو فشل حذف الملف من Firebase، نواصل إزالته من قاعدة البيانات
      // إزالة المرفق من قائمة المرفقات
      const updatedAttachments = targetTransaction.attachments?.filter(att => att.id !== attachmentId) || [];
      
      // تحديث العملية في قاعدة البيانات
      const updatedTransaction = {
        ...targetTransaction,
        attachments: updatedAttachments
      };
      
      await updateTransaction(updatedTransaction);

      // تحديث الحالات المحلية
      if (editingTransaction) {
        setEditingTransaction(updatedTransaction);
      }
      if (previewTransaction) {
        setPreviewTransaction(updatedTransaction);
      }
      
      // تحديث المعاينة
      setPreviewAttachments(updatedAttachments);
      
      // إذا لم تعد هناك مرفقات، أغلق المعاينة
      if (updatedAttachments.length === 0) {
        setIsPreviewOpen(false);
      } else if (currentPreviewIndex >= updatedAttachments.length) {
        setCurrentPreviewIndex(updatedAttachments.length - 1);
      }

      toast({
        title: "تم حذف المرفق",
        description: deleted 
          ? "تم حذف المرفق بنجاح من التخزين وقاعدة البيانات." 
          : "تم حذف المرفق من قاعدة البيانات. (الملف لم يكن موجوداً في التخزين)"
      });
      
    } catch (error) {
      console.error('خطأ في حذف المرفق:', error);
      toast({
        title: "خطأ في الحذف",
        description: "حدث خطأ أثناء حذف المرفق من قاعدة البيانات.",
        variant: "destructive"
      });
    }
  };

  // دالة استبدال مرفق موجود
  const handleReplaceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const targetTransaction = editingTransaction || previewTransaction;
    if (!targetTransaction) return;

    const currentAttachment = previewAttachments?.[currentPreviewIndex];
    if (!currentAttachment) return;

    // التحقق من نوع الملف
    const fileType = file.type;
    let type: 'image' | 'pdf' | 'document' = 'document';
    
    if (fileType.startsWith('image/')) {
      type = 'image';
    } else if (fileType === 'application/pdf') {
      type = 'pdf';
    }

    // التحقق من حجم الملف (أقل من 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "خطأ في الملف",
        description: `حجم الملف كبير جداً. يجب أن يكون أقل من 10MB.`,
        variant: "destructive"
      });
      event.target.value = ''; // إعادة تعيين input
      return;
    }

    try {
      // إظهار رسالة التحميل
      toast({
        title: "جاري استبدال الملف...",
        description: "يرجى الانتظار أثناء رفع الملف الجديد"
      });

      // رفع الملف الجديد
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storageRef = ref(storage, `transactions/${targetTransaction.id}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // حذف الملف القديم من Firebase Storage (بشكل اختياري)
      if (currentAttachment.url) {
        await deleteAttachmentFromFirebase(currentAttachment.url);
      }

      // إنشاء المرفق الجديد
      const newAttachment = {
        ...currentAttachment,
        name: file.name,
        url: downloadURL,
        type: type,
        uploadDate: new Date()
      };

      // تحديث قائمة المرفقات
      const updatedAttachments = targetTransaction.attachments?.map((att, index) => 
        index === currentPreviewIndex ? newAttachment : att
      ) || [];

      // تحديث العملية في قاعدة البيانات
      const updatedTransaction = {
        ...targetTransaction,
        attachments: updatedAttachments
      };

      await updateTransaction(updatedTransaction);

      // تحديث الحالات المحلية
      if (editingTransaction) {
        setEditingTransaction(updatedTransaction);
      }
      if (previewTransaction) {
        setPreviewTransaction(updatedTransaction);
      }

      // تحديث المعاينة
      setPreviewAttachments(updatedAttachments);
      
      // إعادة تعيين حالة المعاينة للملف الجديد
      setImageLoadError(false);
      setImageLoading(true);
      setRetryCount(0);

      toast({
        title: "تم استبدال الملف بنجاح",
        description: `تم استبدال ${currentAttachment.name} بـ ${file.name}`
      });

    } catch (error) {
      console.error('خطأ في استبدال المرفق:', error);
      toast({
        title: "خطأ في الاستبدال",
        description: "حدث خطأ أثناء استبدال الملف. يرجى المحاولة مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      // إعادة تعيين قيمة input
      event.target.value = '';
    }
  };

  // دالة معاينة المرفقات
  const handlePreviewAttachments = (attachments: Transaction['attachments'], transaction?: Transaction) => {
    if (attachments && attachments.length > 0) {
      setPreviewAttachments(attachments);
      setPreviewTransaction(transaction || editingTransaction || null);
      setCurrentPreviewIndex(0);
      setImageLoadError(false); // إعادة تعيين حالة خطأ الصورة
      setImageLoading(true); // بدء تحميل الصورة
      setRetryCount(0); // إعادة تعيين عداد المحاولات
      setIsPreviewOpen(true);
    }
  };

  const handlePreviousAttachment = () => {
    setCurrentPreviewIndex(prev => 
      prev > 0 ? prev - 1 : (previewAttachments?.length || 1) - 1
    );
    setImageLoadError(false); // إعادة تعيين حالة خطأ الصورة
    setImageLoading(true); // بدء تحميل الصورة
    setRetryCount(0); // إعادة تعيين عداد المحاولات
  };

  const handleNextAttachment = () => {
    setCurrentPreviewIndex(prev => 
      prev < (previewAttachments?.length || 1) - 1 ? prev + 1 : 0
    );
    setImageLoadError(false); // إعادة تعيين حالة خطأ الصورة
    setImageLoading(true); // بدء تحميل الصورة
    setRetryCount(0); // إعادة تعيين عداد المحاولات
  };

  const onSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true);
    try {
        const totalPurchasePrice = (values.quantity || 0) * (values.purchasePrice || 0);
        const totalSellingPrice = (values.sellingPrice || 0) > 0 ? (values.quantity || 0) * (values.sellingPrice || 0) : 0;
        
        const profit =
            (values.sellingPrice || 0) > 0
                ? totalSellingPrice - totalPurchasePrice - (values.taxes || 0)
                : 0;

        // حساب الكميات والمبالغ المتبقية للصنف السائب
        const actualQuantityDeducted = values.actualQuantityDeducted || 0;
        const remainingQuantity = (values.quantity || 0) - actualQuantityDeducted;
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
            // رفع المرفقات الجديدة إذا وجدت
            let updatedTransaction = { ...editingTransaction, ...transactionData };
            
            if (attachments.length > 0) {
              setIsUploadingAttachments(true);
              toast({ title: "جاري رفع المرفقات...", description: "يرجى الانتظار..." });
              const uploadedAttachments = await uploadAttachmentsToFirebase(editingTransaction.id);
              if (uploadedAttachments.length > 0) {
                updatedTransaction = {
                  ...updatedTransaction,
                  attachments: [...(editingTransaction.attachments || []), ...uploadedAttachments]
                };
              }
              setIsUploadingAttachments(false);
            }
            await updateTransaction(updatedTransaction);
            toast({ title: "نجاح", description: "تم تعديل العملية بنجاح." });
        } else {
            // إضافة العملية أولاً للحصول على ID حقيقي
            const newTransaction = await addTransaction(transactionData as Omit<Transaction, 'id'>);
            
            // رفع المرفقات باستخدام ID العملية الحقيقي
            if (attachments.length > 0) {
              setIsUploadingAttachments(true);
              toast({ title: "جاري رفع المرفقات...", description: "يرجى الانتظار..." });
              const uploadedAttachments = await uploadAttachmentsToFirebase(newTransaction.id);
              if (uploadedAttachments.length > 0) {
                await updateTransaction({
                  ...newTransaction,
                  attachments: uploadedAttachments
                });
              }
              setIsUploadingAttachments(false);
            }
            
            toast({ title: "نجاح", description: "تمت إضافة العملية بنجاح." });
        }
        form.reset();
        setAttachments([]); // مسح المرفقات بعد الحفظ الناجح
        setIsDialogOpen(false);
    } catch (error) {
        console.error("Error submitting form", error)
        toast({ title: "خطأ في الإدخال", description: "حدث خطأ أثناء حفظ العملية.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
        setIsUploadingAttachments(false);
    }
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
  
  const handleDeleteTransaction = async (transactionId: string) => await deleteTransaction(transactionId);
  
  const handleCreatePaymentFromTransaction = async (transaction: Transaction) => {
    try {
      await createCustomerPaymentFromTransaction(transaction);
      toast({ 
        title: "نجاح", 
        description: `تم إنشاء مدفوعة من العملية ${transaction.operationNumber || transaction.id} بنجاح.` 
      });
    } catch (error) {
      console.error("Error creating payment from transaction:", error);
      toast({ 
        title: "خطأ", 
        description: "حدث خطأ أثناء إنشاء المدفوعة.", 
        variant: "destructive" 
      });
    }
  };

  const {
    totalSales,
    totalPurchases,
    profitFromTransactions,
    totalReceivedFromSuppliers,
    totalPaidToFactory,
  } = useMemo(() => {
    const aggregates = transactions.reduce(
      (acc, t) => {
        acc.totalSales += t.totalSellingPrice;
        acc.totalPurchases += t.totalPurchasePrice;
        acc.totalReceivedFromSuppliers += t.amountReceivedFromSupplier;
        acc.totalPaidToFactory += t.amountPaidToFactory;

        const isSold = t.totalSellingPrice > 0;
        if (isSold) {
          acc.totalTaxesOnSoldItems += t.taxes;
        } else {
          acc.remainingStockValue += t.totalPurchasePrice;
        }
        return acc;
      },
      { totalSales: 0, totalPurchases: 0, remainingStockValue: 0, totalReceivedFromSuppliers: 0, totalPaidToFactory: 0, totalTaxesOnSoldItems: 0 }
    );

    const costOfGoodsSold = aggregates.totalPurchases - aggregates.remainingStockValue;
    const profitBeforeExpenses = aggregates.totalSales - costOfGoodsSold - aggregates.totalTaxesOnSoldItems;

    return {
      totalSales: aggregates.totalSales,
      totalPurchases: aggregates.totalPurchases,
      totalReceivedFromSuppliers: aggregates.totalReceivedFromSuppliers,
      totalPaidToFactory: aggregates.totalPaidToFactory,
      profitFromTransactions: profitBeforeExpenses,
    };
  }, [transactions]);
  
  const totalExpenses = useMemo(() => expenses.reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const totalProfit = profitFromTransactions - totalExpenses;

  const chartData = useMemo(() => {
    const monthlyData: { [key: string]: { profit: number } } = {};
    transactions.forEach(t => {
      const month = format(t.date, 'MMM yyyy', { locale: ar });
      if (!monthlyData[month]) monthlyData[month] = { profit: 0 };
      monthlyData[month].profit += t.profit;
    });
    return Object.entries(monthlyData).map(([name, values]) => ({ name, ...values })).reverse();
  }, [transactions]);
  
  const handleAnalyzePerformance = async () => {
    if (transactions.length === 0) {
      toast({ title: 'لا توجد بيانات كافية', description: 'يجب إضافة بعض العمليات أولاً قبل طلب التحليل.', variant: 'destructive' });
      return;
    }
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const analysisInput = {
        transactions: transactions.map(t => ({ 
          date: t.date.toISOString(), 
          supplierName: t.supplierName, 
          governorate: t.governorate || '', 
          city: t.city || '', 
          totalSellingPrice: t.totalSellingPrice, 
          profit: t.profit 
        })),
        totalProfit: totalProfit, 
        totalExpenses: totalExpenses,
      };

      const response = await fetch('/api/analyze-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisInput),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: PerformanceAnalysisOutput = await response.json();
      setAnalysis(result && result.analysis ? result : { analysis: "لم يتمكن الذكاء الاصطناعي من إنشاء تحليل." });
    } catch (error) {
      console.error("Error generating analysis:", error);
      toast({ title: 'خطأ في التحليل', description: 'حدث خطأ أثناء توليد التحليل.', variant: 'destructive' });
      setAnalysis({ analysis: "لم نتمكن من إتمام التحليل بسبب خطأ فني. يرجى التأكد من إعدادات الذكاء الاصطناعي." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalPurchasePriceDisplay = (watchedValues.quantity || 0) * (watchedValues.purchasePrice || 0);
  const totalSellingPriceDisplay = (watchedValues.sellingPrice || 0) > 0 ? (watchedValues.quantity || 0) * (watchedValues.sellingPrice || 0) : 0;
  const profitDisplay = (watchedValues.sellingPrice || 0) > 0 ? totalSellingPriceDisplay - totalPurchasePriceDisplay - (watchedValues.taxes || 0) : 0;
  
  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 animate-pulse">
        <header className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-2"> <h1 className="text-3xl font-bold text-primary">لوحة التحكم</h1> </div>
          <div className="flex gap-2 flex-wrap justify-center"> <Skeleton className="h-10 w-36" /> <Skeleton className="h-10 w-36" /> <Skeleton className="h-10 w-36" /> </div>
        </header>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card><CardHeader><Skeleton className="h-4 w-3/4 rounded" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 rounded" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-4 w-3/4 rounded" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 rounded" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-4 w-3/4 rounded" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 rounded" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-4 w-3/4 rounded" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 rounded" /></CardContent></Card>
        </div>
        <div className="mb-8">
          <Card>
            <CardHeader> <Skeleton className="h-6 w-1/4 rounded" /> <div className="flex flex-col md:flex-row gap-2 mt-4"> <Skeleton className="h-10 flex-1 rounded" /> <Skeleton className="h-10 w-[240px] rounded" /> </div> </CardHeader>
            <CardContent> <div className="space-y-2"> <Skeleton className="h-12 w-full rounded" /> <Skeleton className="h-12 w-full rounded" /> <Skeleton className="h-12 w-full rounded" /> <Skeleton className="h-12 w-full rounded" /> </div> </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <h1 className="text-3xl font-bold text-primary">لوحة التحكم</h1>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button onClick={() => handleOpenDialog(null)}><Plus className="ml-2 h-4 w-4" />إضافة عملية</Button>
          <Button variant="outline" onClick={() => handleOpenExpenseDialog(null)}><MinusCircle className="ml-2 h-4 w-4" />إضافة مصروف</Button>
          <Button variant="outline" asChild><Link href="/customer-payments"><Wallet className="ml-2 h-4 w-4" />مدفوعات العملاء</Link></Button>
          <Button variant="outline" asChild><Link href="/inventory-report"><Package className="ml-2 h-4 w-4" />تقرير المخزون</Link></Button>
          <Button variant="outline" onClick={handleAnalyzePerformance}><Wand2 className="ml-2 h-4 w-4" />تحليل الأداء</Button>
        </div>
      </header>

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
                          <FormField control={form.control} name="customerName" render={({ field }) => (
                            <FormItem><FormLabel>اسم العميل (اختياري)</FormLabel><FormControl><Input placeholder="اسم العميل" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
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
                                <FormLabel>الدافع (للمصنع)</FormLabel>
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
                            <FormItem><FormLabel>المبلغ المستلم</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="paymentMethodFromSupplier" render={({ field }) => (
                            <FormItem><FormLabel>طريقة الاستلام</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر طريقة الاستلام" /></SelectTrigger></FormControl><SelectContent><SelectItem value="نقدي">نقدي</SelectItem><SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem><SelectItem value="إيداع">إيداع</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="executionDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>تاريخ التنفيذ (اختياري)</FormLabel><Popover modal={false} open={isExecDatePopoverOpen} onOpenChange={setIsExecDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date || undefined); setIsExecDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
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
                            <FormItem className="flex flex-col"><FormLabel>تاريخ الاستحقاق (اختياري)</FormLabel><Popover modal={false} open={isDueDatePopoverOpen} onOpenChange={setIsDueDatePopoverOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="ml-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date || undefined); setIsDueDatePopoverOpen(false); }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                          )} />
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
                  <FormField control={form.control} name="amount" render={({ field }) => (
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المستلم من الموردين</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-success">{totalReceivedFromSuppliers.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المدفوع للمصنع</CardTitle><Factory className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{totalPaidToFactory.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المشتريات</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalPurchases.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalSales.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">صافي الربح (بعد المصروفات)</CardTitle><LineChart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{totalProfit.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</div><p className="text-xs text-muted-foreground">الربح {profitFromTransactions.toLocaleString('ar-EG', {style:'currency', currency: 'EGP'})} - المصروفات {totalExpenses.toLocaleString('ar-EG', {style:'currency', currency: 'EGP'})}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="lg:col-span-1">
           <Card className="h-full flex flex-col">
              <CardHeader><CardTitle className="flex items-center gap-2"><LineChart/> ملخص الربح الشهري</CardTitle></CardHeader>
              <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} />
                      <YAxis width={80} tickFormatter={(value) => new Intl.NumberFormat('ar-EG', { notation: 'compact' }).format(value as number)} />
                      <Tooltip formatter={(value) => [(value as number).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }), 'صافي الربح']} cursor={{fill: 'hsl(var(--muted))'}} />
                      <Bar dataKey="profit" fill="hsl(var(--primary))" name="الربح" radius={[4, 4, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
              </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1 flex flex-col gap-8">
           <Card className="flex-1 flex flex-col">
              <CardHeader><CardTitle className="flex items-center gap-2"><Wand2/> تحليل مالي بالذكاء الاصطناعي</CardTitle></CardHeader>
              <CardContent className="flex-grow flex flex-col">
                  {isAnalyzing ? ( <div className="space-y-4 flex-grow p-4 text-center flex flex-col justify-center"><p className="text-sm text-muted-foreground">جاري تحليل البيانات...</p><Skeleton className="h-4 w-5/6 mx-auto" /><Skeleton className="h-4 w-full mx-auto" /><Skeleton className="h-4 w-4/6 mx-auto" /></div>) : analysis ? (<div className="prose prose-sm dark:prose-invert max-w-none text-right text-sm h-64 overflow-y-auto"><ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.analysis}</ReactMarkdown></div>) : (<div className="text-center text-muted-foreground flex-grow flex flex-col justify-center items-center gap-4"><p className="text-sm">احصل على رؤى حول أدائك المالي.</p><Button onClick={handleAnalyzePerformance} disabled={isAnalyzing}><Wand2 className="ml-2 h-4 w-4" />{isAnalyzing ? "جاري التحليل..." : "توليد التحليل"}</Button></div>)}
              </CardContent>
               {transactions.length > 0 && !analysis && !isAnalyzing && (<CardFooter><p className="text-xs text-muted-foreground w-full text-center">يتم إنشاء التحليل بناءً على البيانات الحالية.</p></CardFooter>)}
            </Card>
        </div>
      </div>

       
      {/* Dialog معاينة المرفقات */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>معاينة المرفقات</span>
              {previewAttachments && previewAttachments.length > 1 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{currentPreviewIndex + 1} من {previewAttachments.length}</span>
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handlePreviousAttachment}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleNextAttachment}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              اعرض وأدر المرفقات المحملة للعملية
            </DialogDescription>
          </DialogHeader>
          
          {previewAttachments && previewAttachments[currentPreviewIndex] && (
            <div className="flex flex-col gap-4 max-h-[calc(90vh-120px)] overflow-auto">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{previewAttachments[currentPreviewIndex].name}</p>
                    <p className="text-sm text-muted-foreground">
                      النوع: {previewAttachments[currentPreviewIndex].type === 'image' ? 'صورة' : 
                              previewAttachments[currentPreviewIndex].type === 'pdf' ? 'PDF' : 'مستند'}
                      {previewAttachments[currentPreviewIndex].category && (
                        <span className="mx-2">•</span>
                      )}
                      {previewAttachments[currentPreviewIndex].category === 'factory_payment' && 'مدفوعات مصنع'}
                      {previewAttachments[currentPreviewIndex].category === 'supplier_receipt' && 'إيصالات موردين'}
                      {previewAttachments[currentPreviewIndex].category === 'invoice' && 'فواتير'}
                      {previewAttachments[currentPreviewIndex].category === 'other' && 'أخرى'}
                    </p>
                  </div>
                </div>
                
                {/* Action buttons for edit, replace and delete */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const attachment = previewAttachments[currentPreviewIndex];
                      const newName = prompt('أدخل اسم جديد للملف:', attachment.name);
                      if (newName && newName.trim() && newName !== attachment.name) {
                        // Update attachment name
                        const updatedAttachments = previewAttachments.map((att, index) => 
                          index === currentPreviewIndex 
                            ? { ...att, name: newName.trim() }
                            : att
                        );
                        setPreviewAttachments(updatedAttachments);
                        
                        // Update the transaction state
                        const targetTransaction = editingTransaction || previewTransaction;
                        if (targetTransaction) {
                          const updatedMainAttachments = targetTransaction.attachments?.map(att => 
                            att.url === attachment.url 
                              ? { ...att, name: newName.trim() }
                              : att
                          );
                          
                          const updatedTransaction = {
                            ...targetTransaction,
                            attachments: updatedMainAttachments || []
                          };
                          
                          if (editingTransaction) {
                            setEditingTransaction(updatedTransaction);
                          }
                          if (previewTransaction) {
                            setPreviewTransaction(updatedTransaction);
                            // Also update in database
                            updateTransaction(updatedTransaction);
                          }
                        }
                        
                        toast({
                          title: "تم تحديث الملف",
                          description: "تم تغيير اسم الملف بنجاح",
                        });
                      }
                    }}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    تعديل
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // Trigger file input for replacement
                      const fileInput = document.getElementById('replace-file-input') as HTMLInputElement;
                      if (fileInput) {
                        fileInput.click();
                      }
                    }}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    استبدال
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const attachment = previewAttachments?.[currentPreviewIndex];
                      if (attachment) {
                        handleDeleteExistingAttachment(attachment.id || attachment.url, attachment.url);
                      }
                    }}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg p-4">
                {previewAttachments[currentPreviewIndex].type === 'image' ? (
                  <>
                    {/* Loading state */}
                    {imageLoading && !imageLoadError && (
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-muted-foreground">جاري تحميل الصورة...</p>
                      </div>
                    )}
                    
                    {/* Image display */}
                    {!imageLoadError && (
                      <img 
                        key={`${previewAttachments[currentPreviewIndex].url}-${retryCount}`}
                        src={previewAttachments[currentPreviewIndex].url}
                        alt={previewAttachments[currentPreviewIndex].name}
                        className={`max-w-full max-h-full object-contain rounded-lg shadow-lg transition-opacity ${
                          imageLoading ? 'opacity-0 absolute' : 'opacity-100'
                        }`}
                        onError={(e) => {
                          console.warn('فشل تحميل الصورة:', {
                            name: previewAttachments[currentPreviewIndex].name,
                            url: previewAttachments[currentPreviewIndex].url,
                            retryCount
                          });
                          setImageLoadError(true);
                          setImageLoading(false);
                        }}
                        onLoad={() => {
                          setImageLoadError(false);
                          setImageLoading(false);
                        }}
                        style={{ display: imageLoading ? 'none' : 'block' }}
                      />
                    )}
                    
                    {/* Error state */}
                    {imageLoadError && (
                      <div className="flex flex-col items-center gap-4 text-center">
                        <FileText className="h-16 w-16 text-destructive" />
                        <div>
                          <p className="font-medium text-destructive">خطأ في تحميل الصورة</p>
                          <p className="text-sm text-muted-foreground">تعذر عرض هذه الصورة</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            الملف: {previewAttachments[currentPreviewIndex].name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 break-all">
                            الرابط: {previewAttachments[currentPreviewIndex].url.substring(0, 80)}...
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button 
                              onClick={() => {
                                setImageLoadError(false);
                                setImageLoading(true);
                                setRetryCount(prev => prev + 1);
                              }}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              إعادة المحاولة ({retryCount + 1})
                            </button>
                            <button 
                              onClick={() => window.open(previewAttachments[currentPreviewIndex].url, '_blank')}
                              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
                            >
                              فتح في نافذة جديدة
                            </button>
                            <button 
                              onClick={() => {
                                console.log('Debug info:', {
                                  name: previewAttachments[currentPreviewIndex].name,
                                  url: previewAttachments[currentPreviewIndex].url,
                                  type: previewAttachments[currentPreviewIndex].type,
                                  retryCount
                                });
                              }}
                              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-400 rounded hover:bg-gray-50 transition-colors"
                            >
                              Debug
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : previewAttachments[currentPreviewIndex].type === 'pdf' ? (
                  <div className="w-full h-[600px] bg-white rounded-lg shadow-lg overflow-hidden">
                    <iframe
                      src={`https://docs.google.com/gview?url=${encodeURIComponent(previewAttachments[currentPreviewIndex].url)}&embedded=true`}
                      className="w-full h-full border-0"
                      title={previewAttachments[currentPreviewIndex].name}
                      onLoad={() => {
                        if (process.env.NODE_ENV === 'development') {
                          console.log('PDF تم تحميله بنجاح:', previewAttachments[currentPreviewIndex].name);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground" />
                    <div>
                      <p className="font-medium">لا يمكن معاينة هذا النوع من الملفات</p>
                      <p className="text-sm text-muted-foreground">نوع الملف غير مدعوم للمعاينة</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Hidden file input for replacement */}
      <input
        id="replace-file-input"
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={handleReplaceFile}
      />
    </div>
  );
}
