
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UploadDialog } from '@/components/ui/upload-dialog';
import { Upload, FileText, Eye } from 'lucide-react';
import { useTransactions } from '@/context/transactions-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function CustomerSalesPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customer, setCustomer] = useState('');
  
  // استخدام context للتعامل مع العمليات
  const { addTransaction, getTransactionByOperationNumber } = useTransactions();
  const { toast } = useToast();
  
  // state للدفعة الجديدة
  const [newPayment, setNewPayment] = useState({
    customer: '',
    amount: '',
    date: '',
    method: ''
  });
  
  // state لفاتورة مبيعات جديدة
  const [newInvoice, setNewInvoice] = useState({
    customer: '',
    amount: '',
    date: '',
    operationNumber: '' // إضافة رقم العملية
  });
  
  const [salesData, setSalesData] = useState<any[]>([]);

  // حالة للمستندات المرفوعة
  const [uploadedDocuments, setUploadedDocuments] = useState<{[key: string]: string}>({});
  
  // حالة للتحميل
  const [isAddingInvoice, setIsAddingInvoice] = useState(false);

  // دالة لتوليد رقم العملية التلقائي
  const generateOperationNumber = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-4); // آخر 4 أرقام من timestamp
    return `OP-${year}${month}${day}-${timestamp}`;
  };

  const totalSales = salesData.reduce((sum, sale) => sum + sale.amount, 0);
  const totalPaid = salesData.reduce((sum, sale) => sum + sale.paidAmount, 0);
  const totalBalance = totalSales - totalPaid;

  // دالة إضافة دفعة جديدة مع الخصم التراكمي
  const handleAddPayment = () => {
    if (!newPayment.customer || !newPayment.amount || !newPayment.date || !newPayment.method) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    // التحقق من صحة المبلغ
    let paymentAmount = parseFloat(newPayment.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    const customerName = newPayment.customer.trim();
    
    // البحث عن فواتير العميل المستحقة (غير المدفوعة بالكامل)
    const customerInvoices = salesData.filter((sale: any) => 
      sale.customer === customerName && sale.amount > sale.paidAmount
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()); // ترتيب حسب التاريخ

    let updatedSalesData = [...salesData];
    let remainingPayment = paymentAmount;

    if (customerInvoices.length > 0) {
      // تطبيق الخصم التراكمي على الفواتير المستحقة
      customerInvoices.forEach((invoice: any) => {
        if (remainingPayment <= 0) return;

        const invoiceIndex = updatedSalesData.findIndex((s: any) => s.id === invoice.id);
        const unpaidAmount = invoice.amount - invoice.paidAmount;
        
        if (remainingPayment >= unpaidAmount) {
          // دفع الفاتورة بالكامل
          updatedSalesData[invoiceIndex] = {
            ...updatedSalesData[invoiceIndex],
            paidAmount: invoice.amount,
            paymentDate: newPayment.date,
            paymentMethod: getPaymentMethodText(newPayment.method),
            status: 'مدفوع'
          };
          remainingPayment -= unpaidAmount;
        } else {
          // دفع جزئي
          updatedSalesData[invoiceIndex] = {
            ...updatedSalesData[invoiceIndex],
            paidAmount: invoice.paidAmount + remainingPayment,
            paymentDate: newPayment.date,
            paymentMethod: getPaymentMethodText(newPayment.method),
            status: 'مدفوع جزئياً'
          };
          remainingPayment = 0;
        }
      });

      // إذا بقي مبلغ بعد سداد جميع الفواتير، أنشئ فاتورة ائتمان
      if (remainingPayment > 0) {
        const newId = salesData.length > 0 ? Math.max(...salesData.map((s: any) => s.id)) + 1 : 1;
        const operationNumber = generateOperationNumber();
        const creditEntry = {
          id: newId,
          customer: customerName,
          date: newPayment.date,
          invoiceNumber: `CREDIT-${String(newId).padStart(3, '0')}`,
          amount: 0,
          paidAmount: remainingPayment,
          paymentDate: newPayment.date,
          paymentMethod: getPaymentMethodText(newPayment.method),
          status: 'رصيد دائن',
          operationNumber: operationNumber
        };
        updatedSalesData.push(creditEntry);
      }
    } else {
      // العميل ليس له فواتير مستحقة، أنشئ دفعة مقدمة
      const newId = salesData.length > 0 ? Math.max(...salesData.map((s: any) => s.id)) + 1 : 1;
      const operationNumber = generateOperationNumber();
      const advancePayment = {
        id: newId,
        customer: customerName,
        date: newPayment.date,
        invoiceNumber: `ADV-${String(newId).padStart(3, '0')}`,
        amount: 0,
        paidAmount: paymentAmount,
        paymentDate: newPayment.date,
        paymentMethod: getPaymentMethodText(newPayment.method),
        status: 'دفعة مقدمة',
        operationNumber: operationNumber
      };
      updatedSalesData.push(advancePayment);
    }

    setSalesData(updatedSalesData);
    
    // إعادة تعيين النموذج
    setNewPayment({
      customer: '',
      amount: '',
      date: '',
      method: ''
    });
    
    alert(`تم تسجيل الدفعة بنجاح! المبلغ: ${paymentAmount.toLocaleString()} ج.م`);
  };

  // دالة لتحويل قيمة طريقة الدفع إلى نص
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'نقداً';
      case 'bank_transfer': return 'تحويل بنكي';
      case 'deposit': return 'إيداع';
      case 'check': return 'شيك';
      default: return '';
    }
  };

  // دالة لمعالجة رفع المستندات
  const handleDocumentUpload = (saleId: number, documentUrl: string) => {
    setUploadedDocuments(prev => ({
      ...prev,
      [saleId]: documentUrl
    }));

    // تحديث بيانات المبيعات لتشمل رابط المستند
    setSalesData(prev => 
      prev.map(sale => 
        sale.id === saleId 
          ? { ...sale, documentUrl: documentUrl }
          : sale
      )
    );

    alert('تم رفع المستند بنجاح!');
  };

  // دالة لعرض المستند
  const handleViewDocument = (documentUrl: string, saleId: number) => {
    if (documentUrl) {
      window.open(documentUrl, '_blank');
    } else {
      alert('لا يوجد مستند مرفق لهذه الدفعة');
    }
  };

  // دالة إضافة فاتورة مبيعات جديدة
  const handleAddInvoice = async () => {
    if (!newInvoice.customer || !newInvoice.amount || !newInvoice.date) {
      alert('يرجى ملء جميع حقول الفاتورة');
      return;
    }

    const invoiceAmount = parseFloat(newInvoice.amount);
    if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح للفاتورة');
      return;
    }

    setIsAddingInvoice(true); // بدء التحميل

    const newId = salesData.length > 0 ? Math.max(...salesData.map((s: any) => s.id)) + 1 : 1;
    const customerName = newInvoice.customer.trim();
    
    // توليد رقم العملية إذا لم يتم إدخاله
    const operationNumber = newInvoice.operationNumber.trim() || generateOperationNumber();

    // البحث عن أي دفعات مقدمة أو رصيد دائن للعميل
    const customerCredits = salesData.filter((sale: any) => 
      sale.customer === customerName && 
      (sale.status === 'دفعة مقدمة' || sale.status === 'رصيد دائن') &&
      sale.paidAmount > 0
    );

    let totalCredit = customerCredits.reduce((sum: number, credit: any) => sum + credit.paidAmount, 0);
    let paidAmount = 0;
    let invoiceStatus = 'معلق';

    // تطبيق الرصيد الدائن على الفاتورة الجديدة
    if (totalCredit > 0) {
      if (totalCredit >= invoiceAmount) {
        paidAmount = invoiceAmount;
        invoiceStatus = 'مدفوع';
        totalCredit -= invoiceAmount;
      } else {
        paidAmount = totalCredit;
        invoiceStatus = 'مدفوع جزئياً';
        totalCredit = 0;
      }

      // تحديث أو حذف الأرصدة الدائنة المستخدمة
      let updatedSalesData = salesData.filter((sale: any) => 
        !(sale.customer === customerName && (sale.status === 'دفعة مقدمة' || sale.status === 'رصيد دائن'))
      );

      // إضافة رصيد دائن متبقي إذا وُجد
      if (totalCredit > 0) {
        const creditId = updatedSalesData.length > 0 ? Math.max(...updatedSalesData.map((s: any) => s.id)) + 1 : newId + 1;
        const remainingCredit = {
          id: creditId,
          customer: customerName,
          date: newInvoice.date,
          invoiceNumber: `CREDIT-${String(creditId).padStart(3, '0')}`,
          amount: 0,
          paidAmount: totalCredit,
          paymentDate: newInvoice.date,
          paymentMethod: 'رصيد سابق',
          status: 'رصيد دائن',
          operationNumber: operationNumber
        };
        updatedSalesData.push(remainingCredit);
      }

      setSalesData(updatedSalesData);
    }

    // إضافة الفاتورة الجديدة
    const newSaleInvoice = {
      id: newId,
      customer: customerName,
      date: newInvoice.date,
      invoiceNumber: `INV-${String(newId).padStart(3, '0')}`,
      amount: invoiceAmount,
      paidAmount: paidAmount,
      paymentDate: paidAmount > 0 ? newInvoice.date : '',
      paymentMethod: paidAmount > 0 ? 'خصم من الرصيد' : '',
      status: invoiceStatus,
      operationNumber: operationNumber
    };

    setSalesData(prev => [...prev, newSaleInvoice]);

    // إضافة العملية إلى سجل العمليات في لوحة التحكم
    let operationRegistered = false;
    try {
      const transactionData = {
        id: `sale-${newId}-${Date.now()}`,
        operationNumber: operationNumber,
        customerName: customerName,
        date: new Date(newInvoice.date),
        supplierName: customerName, // نستخدم اسم العميل كمورد في هذا السياق
        description: `فاتورة مبيعات للعميل ${customerName}`,
        category: 'مبيعات',
        variety: 'فاتورة عميل',
        quantity: 1,
        purchasePrice: 0, // لا يوجد سعر شراء للمبيعات
        totalPurchasePrice: 0,
        sellingPrice: invoiceAmount,
        totalSellingPrice: invoiceAmount,
        taxes: 0,
        profit: invoiceAmount, // المبيعات تعتبر ربح
        amountPaidToFactory: 0,
        amountReceivedFromSupplier: paidAmount,
        paymentMethodFromSupplier: paidAmount > 0 ? 'نقدي' as const : undefined,
      };

      await addTransaction(transactionData);
      operationRegistered = true;
      console.log('✅ تم تسجيل العملية في سجل العمليات بنجاح:', operationNumber);
    } catch (error) {
      console.error('❌ خطأ في إضافة العملية إلى سجل العمليات:', error);
    }

    // إعادة تعيين النموذج
    setNewInvoice({
      customer: '',
      amount: '',
      date: '',
      operationNumber: ''
    });

    // رسالة النجاح حسب حالة التسجيل
    if (operationRegistered) {
      alert(`✅ تم إضافة الفاتورة وتسجيل العملية بنجاح!\n\n📋 رقم الفاتورة: ${newSaleInvoice.invoiceNumber}\n🔢 رقم العملية: ${operationNumber}\n📊 مُسجلة في أرصدة العملاء\n🏠 مُسجلة في سجل العمليات`);
    } else {
      alert(`⚠️ تم إضافة الفاتورة في أرصدة العملاء فقط!\n\n📋 رقم الفاتورة: ${newSaleInvoice.invoiceNumber}\n🔢 رقم العملية: ${operationNumber}\n📊 مُسجلة في أرصدة العملاء\n❌ فشل التسجيل في سجل العمليات\n\nيرجى المحاولة لاحقاً أو مراجعة الاتصال بالإنترنت.`);
    }

    setIsAddingInvoice(false); // إنهاء التحميل
  };

  // دالة لسحب البيانات تلقائياً من رقم العملية
  const handleFetchDataByOperationNumber = () => {
    const opNumber = newInvoice.operationNumber.trim();
    if (!opNumber) return;

    const transaction = getTransactionByOperationNumber(opNumber);

    if (transaction) {
      setNewInvoice({
        ...newInvoice,
        customer: transaction.customerName || '',
        amount: String(transaction.totalPurchasePrice || 0),
        date: format(transaction.date, 'yyyy-MM-dd'),
      });
      toast({
        title: "تم سحب البيانات",
        description: `تم سحب بيانات العملية رقم ${opNumber} بنجاح.`,
      });
    } else {
      toast({
        title: "خطأ",
        description: `لم يتم العثور على عملية بالرقم ${opNumber}.`,
        variant: "destructive",
      });
    }
  };


  return (
    <div className="container mx-auto p-2 space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">أرصدة العملاء</h1>
      </div>

      {/* فلاتر البحث */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">فلترة الأرصدة</CardTitle>
          <CardDescription className="text-sm">
            استخدم الفلاتر أدناه للبحث عن أرصدة العملاء
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dateFrom" className="text-sm">من تاريخ</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo" className="text-sm">إلى تاريخ</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer" className="text-sm">العميل</Label>
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع العملاء</SelectItem>
                  <SelectItem value="ahmed">أحمد محمد</SelectItem>
                  <SelectItem value="fatima">فاطمة علي</SelectItem>
                  <SelectItem value="mohamed">محمد حسن</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full h-9">بحث</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold text-blue-600">
              {totalSales.toLocaleString()} ج.م
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">إجمالي المدفوع</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold text-green-600">
              {totalPaid.toLocaleString()} ج.م
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">الرصيد المتبقي</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold text-red-600">
              {totalBalance.toLocaleString()} ج.م
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">عدد الفواتير</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold">{salesData.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* إضافة فاتورة مبيعات جديدة */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">إضافة فاتورة مبيعات جديدة</CardTitle>
          <CardDescription className="text-sm">
            أضف فاتورة مبيعات للعميل (سيتم خصم أي أرصدة دائنة تلقائياً)
            <br />
            <span className="text-green-600 font-medium">✅ تسجيل تلقائي في سجل العمليات بلوحة التحكم</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label htmlFor="invoiceCustomer" className="text-sm">اسم العميل</Label>
              <Input
                id="invoiceCustomer"
                type="text"
                placeholder="أدخل اسم العميل"
                value={newInvoice.customer}
                onChange={(e) => setNewInvoice({...newInvoice, customer: e.target.value})}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoiceAmount" className="text-sm">مبلغ الفاتورة</Label>
              <Input
                id="invoiceAmount"
                type="number"
                placeholder="0"
                value={newInvoice.amount}
                onChange={(e) => setNewInvoice({...newInvoice, amount: e.target.value})}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoiceDate" className="text-sm">تاريخ الفاتورة</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={newInvoice.date}
                onChange={(e) => setNewInvoice({...newInvoice, date: e.target.value})}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="operationNumber" className="text-sm">رقم العملية (اختياري)</Label>
              <Input
                id="operationNumber"
                type="text"
                placeholder="أدخل لسحب البيانات تلقائياً"
                value={newInvoice.operationNumber}
                onChange={(e) => setNewInvoice({ ...newInvoice, operationNumber: e.target.value })}
                onBlur={handleFetchDataByOperationNumber}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchDataByOperationNumber()}
                className="h-9"
              />
              <div className="text-xs text-gray-500">
                اتركه فارغاً للتوليد التلقائي
              </div>
            </div>
            <div className="flex items-end">
              <Button 
                className="w-full h-9" 
                onClick={handleAddInvoice}
                disabled={isAddingInvoice}
              >
                {isAddingInvoice ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الإضافة...
                  </>
                ) : (
                  'إضافة الفاتورة'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* إضافة مدفوعات جديدة */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">إضافة دفعة جديدة</CardTitle>
          <CardDescription className="text-sm">
            سجل مدفوعات العملاء وطريقة الدفع (سيتم الخصم التراكمي من الفواتير المستحقة)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label htmlFor="paymentCustomer" className="text-sm">اسم العميل</Label>
              <Input
                id="paymentCustomer"
                type="text"
                placeholder="أدخل اسم العميل"
                value={newPayment.customer}
                onChange={(e) => setNewPayment({...newPayment, customer: e.target.value})}
                className="h-9"
              />
              <div className="text-xs text-gray-500">
                {salesData.length > 0 
                  ? `العملاء الحاليون: ${[...new Set(salesData.map((s: any) => s.customer))].join(' • ')}`
                  : 'لا يوجد عملاء مسجلين بعد - أضف أول عميل'}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentAmount" className="text-sm">المبلغ المدفوع</Label>
              <Input
                id="paymentAmount"
                type="number"
                placeholder="0"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentDate" className="text-sm">تاريخ الدفع</Label>
              <Input
                id="paymentDate"
                type="date"
                value={newPayment.date}
                onChange={(e) => setNewPayment({...newPayment, date: e.target.value})}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentMethod" className="text-sm">طريقة الدفع</Label>
              <Select value={newPayment.method} onValueChange={(value) => setNewPayment({...newPayment, method: value})}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقداً</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="deposit">إيداع</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full h-9" onClick={handleAddPayment}>تسجيل الدفعة</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* جدول الأرصدة */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">تفاصيل أرصدة العملاء</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right text-sm">رقم العملية</TableHead>
                  <TableHead className="text-right text-sm">رقم الفاتورة</TableHead>
                  <TableHead className="text-right text-sm">العميل</TableHead>
                  <TableHead className="text-right text-sm">تاريخ الفاتورة</TableHead>
                  <TableHead className="text-right text-sm">مبلغ الفاتورة</TableHead>
                  <TableHead className="text-right text-sm">المبلغ المدفوع</TableHead>
                  <TableHead className="text-right text-sm">تاريخ الدفع</TableHead>
                  <TableHead className="text-right text-sm">طريقة الدفع</TableHead>
                  <TableHead className="text-right text-sm">الرصيد المتبقي</TableHead>
                  <TableHead className="text-right text-sm">المستندات</TableHead>
                  <TableHead className="text-right text-sm">الحالة</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {salesData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="text-lg">📊</div>
                      <div>لا يوجد عملاء مسجلين بعد</div>
                      <div className="text-sm">استخدم النموذج أعلاه لإضافة أول دفعة</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                salesData.map((sale: any) => {
                  const remainingBalance = sale.amount - sale.paidAmount;
                  return (
                    <TableRow key={sale.id} className="text-sm">
                      <TableCell className="font-medium text-sm text-blue-600">
                        {sale.operationNumber || '-'}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{sale.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{sale.customer}</TableCell>
                      <TableCell className="text-sm">{sale.date}</TableCell>
                      <TableCell className="text-blue-600 font-semibold text-sm">
                        {sale.amount.toLocaleString()} ج.م
                      </TableCell>
                      <TableCell className="text-green-600 font-semibold text-sm">
                        {sale.paidAmount.toLocaleString()} ج.م
                      </TableCell>
                      <TableCell className="text-sm">
                        {sale.paymentDate || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sale.paymentMethod || '-'}
                      </TableCell>
                      <TableCell className={`font-semibold text-sm ${remainingBalance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {remainingBalance.toLocaleString()} ج.م
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          {/* زر رفع المستند */}
                          <UploadDialog
                            onUploadComplete={(url) => handleDocumentUpload(sale.id, url)}
                            acceptTypes=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            maxSize={10 * 1024 * 1024} // 10MB
                            uploadPath={`payment-documents/${sale.id}`}
                          >
                            <Button variant="outline" size="sm" className="flex items-center gap-1 h-7 px-2 text-xs">
                              <Upload className="w-3 h-3" />
                              رفع
                            </Button>
                          </UploadDialog>
                          
                          {/* زر عرض المستند */}
                          {(sale.documentUrl || uploadedDocuments[sale.id]) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleViewDocument(sale.documentUrl || uploadedDocuments[sale.id], sale.id)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 h-7 px-2 text-xs"
                            >
                              <Eye className="w-3 h-3" />
                              عرض
                            </Button>
                          )}
                          
                          {/* مؤشر حالة المستند */}
                          {(sale.documentUrl || uploadedDocuments[sale.id]) ? (
                            <div className="flex items-center" title="تم رفع المستند">
                              <FileText className="w-3 h-3 text-green-600" />
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">-</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge
                          variant={sale.status === 'مدفوع' ? 'default' : sale.status === 'مدفوع جزئياً' ? 'secondary' : 'destructive'}
                          className={`text-xs ${
                            sale.status === 'مدفوع'
                              ? 'bg-green-500 hover:bg-green-600'
                              : sale.status === 'مدفوع جزئياً'
                              ? 'bg-yellow-500 hover:bg-yellow-600'
                              : 'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          {sale.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
