







export type Transaction = {
  id: string;
  operationNumber?: string; // رقم العملية
  customerName?: string; // اسم العميل
  date: Date;
  executionDate?: Date;
  showExecutionDate?: boolean;
  dueDate?: Date;
  supplierName: string;
  governorate?: string;
  city?: string;
  description: string;
  category?: string;
  variety?: string;
  quantity: number;
  purchasePrice: number;
  totalPurchasePrice: number;
  sellingPrice: number;
  totalSellingPrice: number;
  taxes: number;
  profit: number;
  
  amountPaidToFactory: number;
  paidBy?: string; // من قام بالدفع للمصنع
  datePaidToFactory?: Date; // تاريخ الدفع للمصنع

  amountReceivedFromSupplier: number;
  receivedBy?: string; // من استلم المبلغ من المورد
  dateReceivedFromSupplier?: Date; // تاريخ الاستلام من المورد
  
  notes?: string; // ملاحظات
  
  // طرق الدفع الجديدة
  paymentMethodToFactory?: 'نقدي' | 'تحويل بنكي' | 'إيداع'; // طريقة دفع المبلغ للمصنع
  paymentMethodFromSupplier?: 'نقدي' | 'تحويل بنكي' | 'إيداع'; // طريقة استلام المبلغ من المورد
  
  // المرفقات
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'pdf' | 'document';
    uploadDate: Date;
    category: 'factory_payment' | 'supplier_receipt' | 'invoice' | 'other';
  }[];
  
  // حقول إدارة المخزون للصنف السائب
  actualQuantityDeducted?: number; // الكمية الفعلية المخصومة
  remainingQuantity?: number; // الكمية المتبقية
  remainingAmount?: number; // المبلغ المتبقي
  transactionDate?: Date; // تاريخ العملية (منفصل عن تاريخ الإدخال)
  transactionNumber?: string; // رقم العملية (مختلف عن رقم العملية الأساسي)

  carrierName?: string; // اسم الناقل
  carrierPhone?: string; // رقم تليفون الناقل
  departureDate?: Date; // تاريخ الخروج

  amountReceivedFromCustomer?: number; // المبلغ المستلم من العميل
  dateReceivedFromCustomer?: Date; // تاريخ استلام المبلغ من العميل
  paymentMethodFromCustomer?: 'نقدي' | 'تحويل بنكي' | 'إيداع' | 'شيك'; // طريقة استلام المبلغ من العميل
  customerPaymentReceivedBy?: string; // من استلم المبلغ من العميل
};

export type Expense = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  paymentOrder?: string;
  supplierName?: string;
  customerName?: string;
};

export type Supplier = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type Customer = {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type CustomerSale = {
  id: string;
  date: Date;
  customerName: string;
  supplierName: string;
  amount: number;
  paidAmount: number;
  status: 'مدفوع' | 'مدفوع جزئياً' | 'معلق' | 'رصيد دائن' | 'دفعة مقدمة';
  invoiceNumber: string;
  operationNumber?: string;
  description?: string;
  paymentDate?: Date;
  paymentMethod?: string;
  documentUrl?: string;
  notes?: string;
  cumulativePaidAmount?: number;
};

export type CustomerBalance = {
  customerName: string;
  totalSales: number; // إجمالي المبيعات للعميل
  totalPayments: number; // إجمالي مبلغ المبيعات من العميل
  balance: number; // الرصيد (موجب = دائن للعميل، سالب = مدين من العميل)
  balanceType: 'creditor' | 'debtor'; // نوع الرصيد
};

export type InventoryBalance = {
  id: string;
  category: string; // الصنف
  variety: string; // النوع
  customerName: string; // العميل
  supplierName: string; // المورد
  governorate: string; // المحافظة
  city: string; // المركز
  totalQuantity: number; // إجمالي الكمية
  totalAmount: number; // إجمالي المبلغ
  actualQuantityDeducted: number; // الكمية الفعلية المخصومة
  remainingQuantity: number; // الكمية المتبقية
  remainingAmount: number; // المبلغ المتبقي
  lastTransactionDate: Date; // تاريخ آخر عملية
  lastTransactionNumber?: string; // رقم آخر عملية
};export type BalanceTransfer = {
  id: string;
  date: Date;
  amount: number;
  fromSupplier: string;
  toSupplier: string;
  fromAccount: 'sales_balance' | 'factory_balance' | 'profit_expense';
  toAccount: 'sales_balance' | 'factory_balance';
  reason: string;
};

export type SupplierPayment = {
  id: string;
  date: Date;
  amount: number;
  fromEntity: string;
  toEntity: string;
  method: 'نقدي' | 'بنكي';
  classification: 'دفعة من رصيد المبيعات' | 'سحب أرباح للمورد' | 'سداد للمصنع عن المورد' | 'استعادة مبلغ كتسوية' | 'سحب مبلغ كتسوية';
  sourceBank?: string;
  status?: 'uploading' | 'completed' | 'upload_failed';
  documentUrl?: string;
  documentPath?: string;
  destinationBank?: string;
  reason: string;
  responsiblePerson: string;
  customerName?: string;
};

export type CustomerPayment = {
  id: string;
  date: Date;
  customerName: string;
  supplierName: string; // المورد الذي باع للعميل
  amount: number;
  paymentMethod: 'نقدي' | 'تحويل بنكي' | 'إيداع';
  receivedStatus: 'تم الاستلام' | 'لم يتم الاستلام' | 'في الانتظار';
  bankName?: string; // اسم البنك في حالة التحويل أو الإيداع
  referenceNumber?: string; // رقم العملية البنكية
  notes?: string;
  
  // الحقول المسحوبة من جدول العمليات
  operationNumber?: string; // رقم العملية
  governorate?: string; // المحافظة
  city?: string; // المركز
  description?: string; // الوصف
  quantity?: number; // الكمية
  sellingPrice?: number; // سعر البيع
  
  // الحقول الجديدة
  carrierName?: string; // اسم الناقل
  carrierPhone?: string; // رقم تليفون الناقل
  departureDate?: Date; // تاريخ الخروج
  
  confirmedDate?: Date; // تاريخ تأكيد الاستلام
  confirmedBy?: string; // المسؤول عن التأكيد
  attachments?: Array<{
    id: string;
    name: string;
    type: 'image' | 'pdf';
    url: string;
    uploadedAt: Date;
  }>; // المرفقات (صور أو ملفات PDF)
  
  // دعم الدفع بالتقسيط
  isInstallment?: boolean; // هل هذه دفعة بالتقسيط
  totalAmount?: number; // المبلغ الإجمالي في حالة التقسيط
  installmentNumber?: number; // رقم القسط (1، 2، 3...)
  totalInstallments?: number; // العدد الإجمالي للأقساط
  parentPaymentId?: string; // معرف الدفعة الأساسية (للأقساط التابعة)
  installmentPlan?: {
    installments: Array<{
      id: string;
      installmentNumber: number;
      amount: number;
      dueDate: Date;
      paidDate?: Date;
      status: 'مستحق' | 'مدفوع' | 'متأخر';
      paymentId?: string; // معرف الدفعة الفعلية عند السداد
    }>;
    createdDate: Date;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
  };

  // النظام المحاسبي التراكمي
  cumulativeTotalPaid?: number; // إجمالي المبلغ المدفوع تراكمياً من العميل
  cumulativeTotalSales?: number; // إجمالي المبيعات التراكمي للعميل
  runningBalance?: number; // الرصيد الجاري (دائن/مدين)
  balanceType?: 'creditor' | 'debtor' | 'balanced'; // نوع الرصيد
  previousBalance?: number; // الرصيد السابق قبل هذه المعاملة
  transactionType?: 'payment' | 'sale' | 'adjustment'; // نوع المعاملة
  accountingNotes?: string; // ملاحظات محاسبية
};

// نوع لتتبع الحساب التراكمي لكل عميل مع مورد معين
export type CustomerAccountingSummary = {
  customerName: string;
  supplierName: string;
  totalSalesAmount: number; // إجمالي مبلغ المبيعات
  totalPaidAmount: number; // إجمالي المبلغ المدفوع
  currentBalance: number; // الرصيد الحالي
  balanceType: 'creditor' | 'debtor' | 'balanced'; // نوع الرصيد
  lastTransactionDate?: number; // تاريخ آخر معاملة كـ timestamp
  firstTransactionDate?: number; // تاريخ أول معاملة كـ timestamp
  transactionCount: number; // عدد المعاملات
  paymentCount: number; // عدد الدفعات
  saleCount: number; // عدد المبيعات
  averageTransactionAmount: number; // متوسط قيمة المعاملة
  paymentMethods: string[]; // طرق الدفع المستخدمة
  hasInstallments: boolean; // هل يوجد تقسيط
  notes?: string; // ملاحظات
};

// نوع لسجل المعاملات المحاسبية
export type AccountingLedgerEntry = {
  id: string;
  date: Date;
  customerName: string;
  supplierName: string;
  transactionType: 'sale' | 'payment' | 'adjustment' | 'return';
  description: string;
  debitAmount: number; // المبلغ المدين
  creditAmount: number; // المبلغ الدائن
  runningBalance: number; // الرصيد الجاري بعد المعاملة
  balanceType: 'creditor' | 'debtor';
  referenceId: string; // معرف المعاملة المرجعية (transaction أو payment)
  notes?: string;
  createdBy?: string;
};
