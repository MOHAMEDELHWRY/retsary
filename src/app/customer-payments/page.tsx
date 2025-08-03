
"use client";

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTransactions } from '@/context/transactions-context';
import { useToast } from '@/hooks/use-toast';
import { type CustomerPayment, type CustomerAccountingSummary } from '@/types';

import {
  DollarSign,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  Plus,
  Check,
  Clock,
  X,
  CreditCard,
  Banknote,
  Building2,
  FileText,
  FileImage,
  Eye,
  BarChart3,
  Calculator,
  HelpCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AttachmentUpload, type AttachmentFile } from '@/components/ui/attachment-upload';
import { InstallmentPlanner } from '@/components/ui/installment-planner';
import { Switch } from '@/components/ui/switch';

const customerPaymentSchema = z.object({
  date: z.date({ required_error: "التاريخ مطلوب." }),
  customerName: z.string().trim().min(1, "اسم العميل مطلوب."),
  supplierName: z.string().trim().min(1, "اسم المورد مطلوب."),
  // قبول القيمة صفر: يمكن إدخال 0 في حالة عدم الدفع
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون صفرًا أو أكبر."),
  paymentMethod: z.enum(['نقدي', 'تحويل بنكي', 'إيداع'], {
    required_error: "طريقة الدفع مطلوبة."
  }),
  receivedStatus: z.enum(['تم الاستلام', 'لم يتم الاستلام', 'في الانتظار'], {
    required_error: "حالة الاستلام مطلوبة."
  }),
  bankName: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  carrierName: z.string().optional(),
  carrierPhone: z.string().optional(),
  departureDate: z.date().optional(),
  isInstallment: z.boolean().optional(),
  totalAmount: z.coerce.number().optional(),
  // الحقول الجديدة المسحوبة من العمليات
  operationNumber: z.string().optional(),
  governorate: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().optional(),
  sellingPrice: z.coerce.number().optional(),
  // النظام المحاسبي التراكمي
  transactionType: z.enum(['payment', 'sale', 'adjustment']).optional().default('payment'),
  accountingNotes: z.string().optional(),
});

type CustomerPaymentFormData = z.infer<typeof customerPaymentSchema>;

// وظائف النظام المحاسبي التراكمي
const calculateRunningBalance = async (
  customerName: string, 
  supplierName: string, 
  currentAmount: number, 
  transactionType: 'payment' | 'sale' | 'adjustment' = 'payment',
  existingPayments: CustomerPayment[]
): Promise<{
  cumulativeTotalPaid: number;
  runningBalance: number;
  balanceType: 'creditor' | 'debtor' | 'balanced';
  previousBalance: number;
  cumulativeTotalSales: number; // Add this
}> => {
  // قراءة جميع المعاملات السابقة للعميل مع المورد
  const existingTransactions = existingPayments.filter(
    (t: CustomerPayment) => t.customerName === customerName && t.supplierName === supplierName
  );
  
  // حساب إجمالي المبلغ المدفوع
  const cumulativeTotalPaid = existingTransactions
    .filter((t: CustomerPayment) => t.transactionType === 'payment')
    .reduce((sum: number, t: CustomerPayment) => sum + (t.amount || 0), 0);
  
  // حساب إجمالي المبيعات
  const totalSales = existingTransactions
    .filter((t: CustomerPayment) => t.transactionType === 'sale')
    .reduce((sum: number, t: CustomerPayment) => sum + (t.amount || 0), 0);
  
  const previousBalance = cumulativeTotalPaid - totalSales;
  
  // حساب الرصيد الجديد
  let newBalance = previousBalance;
  if (transactionType === 'payment') {
    newBalance = previousBalance + currentAmount;
  } else if (transactionType === 'sale') {
    newBalance = previousBalance - currentAmount;
  }
  
  // تحديد نوع الرصيد
  let balanceType: 'creditor' | 'debtor' | 'balanced';
  if (newBalance > 0) {
    balanceType = 'creditor'; // رصيد دائن (العميل دفع أكثر)
  } else if (newBalance < 0) {
    balanceType = 'debtor'; // رصيد مدين (العميل مدين)
  } else {
    balanceType = 'balanced'; // رصيد متوازن
  }
  
  return {
    cumulativeTotalPaid: cumulativeTotalPaid + (transactionType === 'payment' ? currentAmount : 0),
    runningBalance: newBalance,
    balanceType,
    previousBalance,
    cumulativeTotalSales: totalSales + (transactionType === 'sale' ? currentAmount : 0),
  };
};

const getAccountingSummary = (customerName: string, supplierName: string, existingPayments: CustomerPayment[]): CustomerAccountingSummary => {
    const customerTransactions = existingPayments.filter(
      (t: CustomerPayment) => t.customerName === customerName && t.supplierName === supplierName
    );
    
    const totalSalesAmount = customerTransactions
      .filter((t: CustomerPayment) => t.transactionType === 'sale' || (t.amount < 0)) // Also consider negative amounts as sales
      .reduce((sum: number, t: CustomerPayment) => sum + Math.abs(t.amount || 0), 0);
    
    const totalPaidAmount = customerTransactions
      .filter((t: CustomerPayment) => t.transactionType === 'payment' && t.amount >= 0)
      .reduce((sum: number, t: CustomerPayment) => sum + (t.amount || 0), 0);
    
    const currentBalance = totalPaidAmount - totalSalesAmount;
    
    return {
      customerName,
      supplierName,
      totalSalesAmount,
      totalPaidAmount,
      currentBalance,
      balanceType: currentBalance > 0 ? 'creditor' : currentBalance < 0 ? 'debtor' : 'balanced',
      transactionCount: customerTransactions.length,
      paymentCount: customerTransactions.filter((t: CustomerPayment) => t.transactionType === 'payment').length,
      saleCount: customerTransactions.filter((t: CustomerPayment) => t.transactionType === 'sale').length,
      lastTransactionDate: customerTransactions.length > 0 
        ? Math.max(...customerTransactions.map((t: CustomerPayment) => new Date(t.date).getTime()))
        : undefined,
      firstTransactionDate: customerTransactions.length > 0 
        ? Math.min(...customerTransactions.map((t: CustomerPayment) => new Date(t.date).getTime()))
        : undefined,
      averageTransactionAmount: customerTransactions.length > 0 
        ? customerTransactions.reduce((sum: number, t: CustomerPayment) => sum + (t.amount || 0), 0) / customerTransactions.length
        : 0,
      paymentMethods: [...new Set(customerTransactions.map((t: CustomerPayment) => t.paymentMethod))],
      hasInstallments: customerTransactions.some((t: CustomerPayment) => t.isInstallment),
      notes: `حساب ${customerName} مع ${supplierName}`
    };
  };

export default function CustomerPaymentsPage() {
  const { 
    customerPayments, 
    addCustomerPayment, 
    updateCustomerPayment, 
    deleteCustomerPayment, 
    confirmCustomerPayment,
    getCustomerBalance,
    createCustomerPaymentDataFromTransaction,
    getTransactionByOperationNumber,
    customerNames: allCustomerNames,
    supplierNames, 
    loading 
  } = useTransactions();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isDepartureDatePopoverOpen, setIsDepartureDatePopoverOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isInstallmentPayment, setIsInstallmentPayment] = useState(false);
  const [installmentPlan, setInstallmentPlan] = useState<any>(null);
  const [showAccountingSummary, setShowAccountingSummary] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');

  // إحصائيات النظام المحاسبي
  const customerSupplierPairs = useMemo(() => {
    const pairs = new Set(customerPayments.map(p => `${p.customerName}-${p.supplierName}`));
    return Array.from(pairs).map(pair => {
      const [customer, supplier] = pair.split('-');
      return { customer, supplier };
    });
  }, [customerPayments]);

  const accountingSummaries = useMemo(() => {
    return customerSupplierPairs.map(pair => 
      getAccountingSummary(pair.customer, pair.supplier, customerPayments)
    );
  }, [customerSupplierPairs, customerPayments]);

  const totalCreditors = accountingSummaries.filter(s => s.balanceType === 'creditor').length;
  const totalDebtors = accountingSummaries.filter(s => s.balanceType === 'debtor').length;
  const totalCreditorAmount = accountingSummaries
    .filter(s => s.balanceType === 'creditor')
    .reduce((sum, s) => sum + s.currentBalance, 0);
  const totalDebtorAmount = accountingSummaries
    .filter(s => s.balanceType === 'debtor')
    .reduce((sum, s) => sum + Math.abs(s.currentBalance), 0);

  const form = useForm<CustomerPaymentFormData>({
    resolver: zodResolver(customerPaymentSchema),
    defaultValues: {
      date: new Date(),
      customerName: "",
      supplierName: "",
      amount: 0,
      paymentMethod: 'نقدي',
      receivedStatus: 'في الانتظار',
      bankName: "",
      referenceNumber: "",
      notes: "",
      carrierName: "",
      carrierPhone: "",
      departureDate: undefined,
      operationNumber: "",
      governorate: "",
      city: "",
      description: "",
      quantity: undefined,
      sellingPrice: undefined,
    },
  });

  const { watch } = form;
  const watchedPaymentMethod = watch("paymentMethod");

  // Get unique customer names
  const customerNames = useMemo(() => {
    const paymentCustomers = new Set(customerPayments.map(p => p.customerName));
    const allCustomers = new Set([...paymentCustomers, ...allCustomerNames]);
    return Array.from(allCustomers).sort();
  }, [customerPayments, allCustomerNames]);

  // Get customer balances
  const customerBalances = useMemo(() => {
    return customerNames.map(customerName => ({
      customerName,
      balance: getCustomerBalance(customerName)
    }));
  }, [customerNames, getCustomerBalance]);

  // دالة لملء البيانات تلقائياً من رقم العملية
  const handleOperationNumberChange = (operationNumber: string) => {
    if (!operationNumber.trim()) return;
    
    const transaction = getTransactionByOperationNumber(operationNumber.trim());
    if (transaction) {
      const paymentData = createCustomerPaymentDataFromTransaction(transaction);
      
      // تحديث الحقول في النموذج
      form.setValue('customerName', paymentData.customerName);
      form.setValue('supplierName', paymentData.supplierName);
      form.setValue('amount', paymentData.amount);
      form.setValue('governorate', paymentData.governorate || '');
      form.setValue('city', paymentData.city || '');
      form.setValue('description', paymentData.description || '');
      form.setValue('quantity', paymentData.quantity || undefined);
      form.setValue('sellingPrice', paymentData.sellingPrice || undefined);
      
      toast({ 
        title: "تم تحديث البيانات", 
        description: `تم تحديث بيانات المدفوعة تلقائياً من العملية رقم ${operationNumber}` 
      });
    } else {
      toast({ 
        title: "لم يتم العثور على العملية", 
        description: `لا توجد عملية برقم ${operationNumber}`,
        variant: "destructive"
      });
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalAmount = customerPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const receivedAmount = customerPayments
      .filter(p => p.receivedStatus === 'تم الاستلام')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const pendingAmount = customerPayments
      .filter(p => p.receivedStatus === 'في الانتظار')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const notReceivedAmount = customerPayments
      .filter(p => p.receivedStatus === 'لم يتم الاستلام')
      .reduce((sum, payment) => sum + payment.amount, 0);

    return { totalAmount, receivedAmount, pendingAmount, notReceivedAmount };
  }, [customerPayments]);

  const handleOpenDialog = (payment: CustomerPayment | null = null) => {
    if (payment) {
      setEditingPayment(payment);
      form.reset({
        date: payment.date,
        customerName: payment.customerName,
        supplierName: payment.supplierName,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        receivedStatus: payment.receivedStatus,
        bankName: payment.bankName || "",
        referenceNumber: payment.referenceNumber || "",
        notes: payment.notes || "",
        carrierName: payment.carrierName || "",
        carrierPhone: payment.carrierPhone || "",
        departureDate: payment.departureDate || undefined,
        operationNumber: payment.operationNumber || "",
        governorate: payment.governorate || "",
        city: payment.city || "",
        description: payment.description || "",
        quantity: payment.quantity || undefined,
        sellingPrice: payment.sellingPrice || undefined,
        isInstallment: payment.isInstallment || false,
        totalAmount: payment.totalAmount || payment.amount,
      });
      // Load existing attachments
      setAttachments(payment.attachments || []);
      // Load installment settings
      setIsInstallmentPayment(payment.isInstallment || false);
      setInstallmentPlan(payment.installmentPlan || null);
    } else {
      setEditingPayment(null);
      form.reset({
        date: new Date(),
        customerName: "",
        supplierName: "",
        amount: 0,
        paymentMethod: 'نقدي',
        receivedStatus: 'في الانتظار',
        bankName: "",
        referenceNumber: "",
        notes: "",
        carrierName: "",
        carrierPhone: "",
        departureDate: undefined,
        isInstallment: false,
        totalAmount: 0,
      });
      // Clear attachments for new payment
      setAttachments([]);
      // Clear installment settings
      setIsInstallmentPayment(false);
      setInstallmentPlan(null);
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: CustomerPaymentFormData) => {
    setIsSubmitting(true);
    try {
      // حساب النظام المحاسبي التراكمي
      const accountingData = await calculateRunningBalance(
        data.customerName,
        data.supplierName,
        data.amount,
        data.transactionType || 'payment',
        customerPayments
      );
      
      const paymentData = {
        ...data,
        bankName: (data.paymentMethod === 'نقدي') ? undefined : data.bankName,
        referenceNumber: (data.paymentMethod === 'نقدي') ? undefined : data.referenceNumber,
        attachments: attachments.map(att => ({
          id: att.id,
          name: att.name,
          type: att.type,
          url: att.url,
          uploadedAt: att.uploadedAt,
        })),
        isInstallment: isInstallmentPayment,
        installmentPlan: isInstallmentPayment ? installmentPlan : undefined,
        totalAmount: isInstallmentPayment ? data.totalAmount : data.amount,
        // النظام المحاسبي التراكمي
        cumulativeTotalPaid: accountingData.cumulativeTotalPaid,
        cumulativeTotalSales: accountingData.cumulativeTotalSales,
        runningBalance: accountingData.runningBalance,
        balanceType: accountingData.balanceType,
        previousBalance: accountingData.previousBalance,
        transactionType: data.transactionType || 'payment',
        accountingNotes: data.accountingNotes || `${accountingData.balanceType === 'creditor' ? 'رصيد دائن' : 
          accountingData.balanceType === 'debtor' ? 'رصيد مدين' : 'رصيد متوازن'}: ${Math.abs(accountingData.runningBalance)} جنيه`
      };

      if (editingPayment) {
        await updateCustomerPayment({ ...paymentData, id: editingPayment.id } as CustomerPayment);
        toast({ 
          title: "تم التحديث", 
          description: `تم تحديث مدفوعة العميل. الرصيد الحالي: ${accountingData.runningBalance} جنيه (${accountingData.balanceType === 'creditor' ? 'دائن' : 
            accountingData.balanceType === 'debtor' ? 'مدين' : 'متوازن'})` 
        });
      } else {
        await addCustomerPayment(paymentData);
        toast({ 
          title: "تم الإضافة", 
          description: `تم إضافة مدفوعة العميل. الرصيد الحالي: ${accountingData.runningBalance} جنيه (${accountingData.balanceType === 'creditor' ? 'دائن' : 
            accountingData.balanceType === 'debtor' ? 'مدين' : 'متوازن'})` 
        });
      }
      form.reset();
      setAttachments([]);
      setIsInstallmentPayment(false);
      setInstallmentPlan(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error submitting customer payment: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حفظ مدفوعة العميل.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    try {
      await confirmCustomerPayment(paymentId, "النظام"); // يمكن تخصيص اسم المستخدم
      toast({ title: "تم التأكيد", description: "تم تأكيد استلام المدفوعة بنجاح." });
    } catch (error) {
      toast({ title: "خطأ", description: "لم نتمكن من تأكيد الاستلام.", variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'تم الاستلام':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'في الانتظار':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'لم يتم الاستلام':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'تم الاستلام':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">تم الاستلام</Badge>;
      case 'في الانتظار':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">في الانتظار</Badge>;
      case 'لم يتم الاستلام':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">لم يتم الاستلام</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // دالة لتنسيق التاريخ بأمان
  const formatDateSafely = (date: Date | undefined) => {
    if (!date || isNaN(date.getTime())) {
      return '-';
    }
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      return '-';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'نقدي':
        return <Banknote className="h-4 w-4 text-green-600" />;
      case 'تحويل بنكي':
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'إيداع':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="w-full px-2 py-2 sm:px-4 sm:py-4 md:px-6 md:py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-2 py-2 sm:px-4 sm:py-4 md:px-6 md:py-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">مبيعات العملاء</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowAccountingSummary(true)} variant="outline" className="w-full sm:w-auto">
            <Calculator className="ml-2 h-4 w-4" />
            الملخص المحاسبي
          </Button>
          <Button onClick={() => handleOpenDialog(null)} className="w-full sm:w-auto">
            <Plus className="ml-2 h-4 w-4" />
            إضافة مدفوعة عميل
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي مبلغ المبيعات</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{totals.totalAmount.toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تم الاستلام</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-600">{totals.receivedAmount.toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">في الانتظار</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">{totals.pendingAmount.toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">لم يتم الاستلام</CardTitle>
            <X className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-600">{totals.notReceivedAmount.toLocaleString('ar-EG')} ج.م</div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6 sm:mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            شرح آلية عمل الجدول
          </CardTitle>
          <CardDescription>
            هذا الجدول يعمل كسجل محاسبي تراكمي (Ledger) لكل عميل مع كل مورد.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            - **الإجمالي المدفوع:** هذا العمود يعرض إجمالي المبلغ الذي دفعه العميل لهذا المورد المحدد **حتى تاريخ هذه العملية**.
          </p>
          <p>
            - **الرصيد الحالي:** هذا هو الرصيد المباشر للحساب بعد كل معاملة (فاتورة أو دفعة). يتم حسابه كـ (مجموع كل الدفعات - مجموع كل المبيعات).
          </p>
          <p>
            - **نوع الرصيد:** يوضح حالة الرصيد الحالي. **دائن** يعني أن العميل له رصيد لدينا، **مدين** يعني أنه عليه رصيد مستحق.
          </p>
        </CardContent>
      </Card>


      {/* Customer Balances */}
      <Card className="mb-6 sm:mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BarChart3 className="h-5 w-5" />
            أرصدة العملاء التراكمية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {customerBalances.map(({ customerName, balance }) => (
              <Card key={customerName} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium text-sm">{customerName}</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي المبلغ المدفوع:</span>
                      <span className="font-medium">{balance.totalSales.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي مبلغ المبيعات:</span>
                      <span className="font-medium">{balance.totalPayments.toLocaleString()} ج.م</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">الرصيد:</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${
                            balance.balance > 0 ? 'text-red-600' : 
                            balance.balance < 0 ? 'text-green-600' : 
                            'text-gray-600'
                          }`}>
                            {Math.abs(balance.balance).toLocaleString()} ج.م
                          </span>
                          <Badge 
                            variant={
                              balance.balanceType === 'creditor' ? 'default' :
                              balance.balanceType === 'debtor' ? 'destructive' : 'secondary'
                            } 
                            className="text-xs"
                          >
                            {balance.balanceType === 'creditor' ? 'دائن' :
                             balance.balanceType === 'debtor' ? 'مدين' : 'متوازن'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {customerBalances.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                لا توجد أرصدة عملاء متاحة
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">سجل مبيعات العملاء</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="relative w-full overflow-auto">
            <Table className="[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">التاريخ</TableHead>
                  <TableHead className="min-w-[120px]">رقم العملية</TableHead>
                  <TableHead className="min-w-[120px]">العميل</TableHead>
                  <TableHead className="min-w-[100px]">المورد</TableHead>
                  <TableHead className="min-w-[100px]">المحافظة</TableHead>
                  <TableHead className="min-w-[100px]">المركز</TableHead>
                  <TableHead className="min-w-[100px]">المبلغ</TableHead>
                  <TableHead className="min-w-[100px]">الرصيد الحالي</TableHead>
                  <TableHead className="min-w-[80px]">نوع الرصيد</TableHead>
                  <TableHead className="min-w-[80px]">الكمية</TableHead>
                  <TableHead className="min-w-[100px]">سعر البيع</TableHead>
                  <TableHead className="min-w-[120px]">نوع الدفع</TableHead>
                  <TableHead className="min-w-[100px]">طريقة الدفع</TableHead>
                  <TableHead className="min-w-[120px]">الناقل</TableHead>
                  <TableHead className="min-w-[120px]">تليفون الناقل</TableHead>
                  <TableHead className="min-w-[100px]">تاريخ الخروج</TableHead>
                  <TableHead className="min-w-[150px]">تفاصيل الدفع</TableHead>
                  <TableHead className="min-w-[100px]">المرفقات</TableHead>
                  <TableHead className="min-w-[150px]">حالة الاستلام</TableHead>
                  <TableHead className="text-right min-w-[100px]">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-12 text-muted-foreground">
                      لا توجد مدفوعات عملاء مسجلة
                    </TableCell>
                  </TableRow>
                ) : (
                  customerPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDateSafely(payment.date)}</TableCell>
                      <TableCell className="text-xs">{payment.operationNumber || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="font-medium">{payment.customerName}</TableCell>
                      <TableCell>{payment.supplierName}</TableCell>
                      <TableCell className="text-xs">{payment.governorate || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-xs">{payment.city || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="font-semibold text-gray-800">
                        {payment.amount.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      {/* الأعمدة المحاسبية الجديدة */}
                      <TableCell className={`font-semibold ${
                        payment.balanceType === 'creditor' ? 'text-green-700' : 
                        payment.balanceType === 'debtor' ? 'text-red-700' : 'text-gray-700'
                      }`}>
                        {payment.runningBalance !== undefined ? `${payment.runningBalance.toLocaleString('ar-EG')} ج.م` : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {payment.balanceType ? (
                          <Badge variant={payment.balanceType === 'creditor' ? 'default' : payment.balanceType === 'debtor' ? 'destructive' : 'secondary'}>
                            {payment.balanceType === 'creditor' ? 'دائن' : payment.balanceType === 'debtor' ? 'مدين' : 'متوازن'}
                          </Badge>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      
                      <TableCell className="text-xs">{payment.quantity || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-xs">{payment.sellingPrice ? `${payment.sellingPrice.toLocaleString()} ج.م` : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        {payment.isInstallment ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                              <BarChart3 className="h-3 w-3 mr-1" />
                              تقسيط
                            </Badge>
                            {payment.installmentNumber && payment.totalInstallments && (
                              <span className="text-xs text-muted-foreground">
                                {payment.installmentNumber}/{payment.totalInstallments}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            <DollarSign className="h-3 w-3 mr-1" />
                            دفعة واحدة
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(payment.paymentMethod)}
                          {payment.paymentMethod}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {payment.carrierName || <span className="text-muted-foreground">لا يوجد</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {payment.carrierPhone || <span className="text-muted-foreground">لا يوجد</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {payment.departureDate ? formatDateSafely(payment.departureDate) : <span className="text-muted-foreground">لا يوجد</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {payment.paymentMethod !== 'نقدي' && (
                          <div className="flex flex-col gap-1">
                            {payment.bankName && <span><strong>البنك:</strong> {payment.bankName}</span>}
                            {payment.referenceNumber && <span><strong>رقم العملية:</strong> {payment.referenceNumber}</span>}
                          </div>
                        )}
                        {payment.paymentMethod === 'نقدي' && (
                          <span className="text-muted-foreground">دفع نقدي</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.attachments && payment.attachments.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1">
                              {payment.attachments.slice(0, 3).map((attachment, index) => (
                                <Button
                                  key={attachment.id}
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full border-2 border-background"
                                  onClick={() => window.open(attachment.url, '_blank')}
                                >
                                  {attachment.type === 'image' ? (
                                    <FileImage className="h-3 w-3 text-blue-500" />
                                  ) : (
                                    <FileText className="h-3 w-3 text-red-500" />
                                  )}
                                </Button>
                              ))}
                            </div>
                            {payment.attachments.length > 3 && (
                              <Badge variant="secondary" className="text-xs h-5">
                                +{payment.attachments.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">لا يوجد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(payment.receivedStatus)}
                          {payment.receivedStatus === 'في الانتظار' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirmPayment(payment.id)}
                              className="h-6 px-2 text-xs whitespace-nowrap"
                            >
                              تأكيد الاستلام
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(payment)}
                            className="text-muted-foreground hover:text-primary h-8 w-8"
                          >
                            <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="sr-only">تعديل</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8">
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="sr-only">حذف</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base">هل أنت متأكد؟</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                  سيتم حذف هذه المدفوعة نهائياً. لا يمكن التراجع عن هذا الإجراء.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                                <AlertDialogCancel className="w-full sm:w-auto">إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCustomerPayment(payment.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                                >
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingPayment ? "تعديل مدفوعة عميل" : "إضافة مدفوعة عميل جديدة"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* رقم العملية - للتحديث التلقائي */}
              <FormField
                control={form.control}
                name="operationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">رقم العملية (للتحديث التلقائي)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="أدخل رقم العملية لتحديث البيانات تلقائياً"
                        onBlur={(e) => {
                          field.onBlur();
                          if (e.target.value) {
                            handleOperationNumberChange(e.target.value);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm">تاريخ المدفوعة</FormLabel>
                      <Popover modal={false} open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
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
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setIsDatePopoverOpen(false);
                            }}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            className="w-auto"
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
                      <FormLabel className="text-sm">{isInstallmentPayment ? "مبلغ هذا القسط" : "المبلغ"}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* خيار الدفع بالتقسيط */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Switch
                    id="installment-mode"
                    checked={isInstallmentPayment}
                    onCheckedChange={(checked) => {
                      setIsInstallmentPayment(checked);
                      if (!checked) {
                        setInstallmentPlan(null);
                        form.setValue('totalAmount', form.getValues('amount'));
                      }
                    }}
                  />
                  <Label htmlFor="installment-mode" className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4" />
                    دفع بالتقسيط
                  </Label>
                </div>

                {isInstallmentPayment && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="totalAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">المبلغ الإجمالي للتقسيط</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} className="text-base" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {(form.watch('totalAmount') || 0) > 0 && (
                      <InstallmentPlanner
                        totalAmount={form.watch('totalAmount') || 0}
                        onPlanChange={setInstallmentPlan}
                        existingPlan={installmentPlan}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">اسم العميل</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم العميل" {...field} className="text-base" />
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
                      <FormLabel className="text-sm">المورد</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-base">
                            <SelectValue placeholder="اختر المورد..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {supplierNames.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* الحقول المسحوبة من العمليات */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="governorate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">المحافظة</FormLabel>
                      <FormControl>
                        <Input placeholder="المحافظة" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">المركز</FormLabel>
                      <FormControl>
                        <Input placeholder="المركز" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">الكمية</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="الكمية"
                          {...field}
                          className="text-base"
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">سعر البيع</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="سعر البيع"
                          {...field}
                          className="text-base"
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">وصف العملية</FormLabel>
                      <FormControl>
                        <Input placeholder="وصف العملية" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* حقول الناقل وتاريخ الخروج */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="carrierName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">اسم الناقل (اختياري)</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم الناقل" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="carrierPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">رقم تليفون الناقل (اختياري)</FormLabel>
                      <FormControl>
                        <Input placeholder="رقم التليفون" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departureDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm">تاريخ الخروج (اختياري)</FormLabel>
                      <Popover modal={false} open={isDepartureDatePopoverOpen} onOpenChange={setIsDepartureDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full justify-start text-right font-normal text-sm sm:text-base", !field.value && "text-muted-foreground")}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP", { locale: ar }) : <span>اختر تاريخ الخروج</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setIsDepartureDatePopoverOpen(false);
                            }}
                            initialFocus
                            className="w-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">طريقة الدفع</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-base">
                            <SelectValue placeholder="اختر طريقة الدفع..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="نقدي">نقدي</SelectItem>
                          <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                          <SelectItem value="إيداع">إيداع</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="receivedStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">حالة الاستلام</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-base">
                            <SelectValue placeholder="اختر حالة الاستلام..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="تم الاستلام">تم الاستلام</SelectItem>
                          <SelectItem value="في الانتظار">في الانتظار</SelectItem>
                          <SelectItem value="لم يتم الاستلام">لم يتم الاستلام</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Bank Details (only for non-cash payments) */}
              {watchedPaymentMethod !== 'نقدي' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/50">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">اسم البنك</FormLabel>
                        <FormControl>
                          <Input placeholder="اسم البنك" {...field} className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="referenceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">رقم العملية</FormLabel>
                        <FormControl>
                          <Input placeholder="رقم التحويل أو الإيداع" {...field} className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* النظام المحاسبي التراكمي */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transactionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">نوع المعاملة</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'payment'}>
                        <FormControl>
                          <SelectTrigger className="text-base">
                            <SelectValue placeholder="اختر نوع المعاملة..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="payment">دفعة</SelectItem>
                          <SelectItem value="sale">مبيعة</SelectItem>
                          <SelectItem value="adjustment">تسوية</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountingNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">ملاحظات محاسبية</FormLabel>
                      <FormControl>
                        <Input placeholder="ملاحظات خاصة بالمحاسبة..." {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">ملاحظات إضافية</FormLabel>
                    <FormControl>
                      <Textarea placeholder="ملاحظات حول المدفوعة..." {...field} className="min-h-[60px] text-base" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Attachment Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">المرفقات</label>
                <AttachmentUpload
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  maxFiles={5}
                  maxSize={10}
                />
              </div>

              <DialogFooter className="pt-4 flex-col-reverse sm:flex-row gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" className="w-full sm:w-auto">إلغاء</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? 'جاري الحفظ...' : (editingPayment ? 'حفظ التعديلات' : 'إضافة المدفوعة')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* حوار الملخص المحاسبي */}
      <Dialog open={showAccountingSummary} onOpenChange={setShowAccountingSummary}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">الملخص المحاسبي - مدفوعات العملاء</DialogTitle>
            <DialogDescription>عرض شامل للوضع المحاسبي لجميع العملاء والموردين</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* إحصائيات عامة */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{totalCreditors}</div>
                  <div className="text-sm text-muted-foreground">عملاء دائنين</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-700">{totalDebtors}</div>
                  <div className="text-sm text-muted-foreground">عملاء مدينين</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{totalCreditorAmount.toLocaleString('ar-EG')}</div>
                  <div className="text-sm text-muted-foreground">إجمالي الرصيد الدائن (ج.م)</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-700">{totalDebtorAmount.toLocaleString('ar-EG')}</div>
                  <div className="text-sm text-muted-foreground">إجمالي الرصيد المدين (ج.م)</div>
                </div>
              </Card>
            </div>

            {/* تفاصيل الحسابات */}
            <div>
              <h3 className="text-lg font-semibold mb-4">تفاصيل حسابات العملاء</h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العميل</TableHead>
                      <TableHead>المورد</TableHead>
                      <TableHead>إجمالي المبيعات</TableHead>
                      <TableHead>إجمالي المدفوع</TableHead>
                      <TableHead>الرصيد الحالي</TableHead>
                      <TableHead>نوع الرصيد</TableHead>
                      <TableHead>عدد المعاملات</TableHead>
                      <TableHead>متوسط المعاملة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountingSummaries.map((summary, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{summary.customerName}</TableCell>
                        <TableCell>{summary.supplierName}</TableCell>
                        <TableCell>{summary.totalSalesAmount.toLocaleString('ar-EG')} ج.م</TableCell>
                        <TableCell>{summary.totalPaidAmount.toLocaleString('ar-EG')} ج.م</TableCell>
                        <TableCell className={`font-semibold ${
                          summary.balanceType === 'creditor' ? 'text-green-700' : 
                          summary.balanceType === 'debtor' ? 'text-red-700' : 'text-gray-700'
                        }`}>
                          {Math.abs(summary.currentBalance).toLocaleString('ar-EG')} ج.م
                        </TableCell>
                        <TableCell>
                          <Badge variant={summary.balanceType === 'creditor' ? 'default' : summary.balanceType === 'debtor' ? 'destructive' : 'secondary'}>
                            {summary.balanceType === 'creditor' ? 'دائن' : summary.balanceType === 'debtor' ? 'مدين' : 'متوازن'}
                          </Badge>
                        </TableCell>
                        <TableCell>{summary.transactionCount}</TableCell>
                        <TableCell>{summary.averageTransactionAmount.toLocaleString('ar-EG')} ج.م</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowAccountingSummary(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    