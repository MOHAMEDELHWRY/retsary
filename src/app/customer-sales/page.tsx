
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UploadDialog } from '@/components/ui/upload-dialog';
import { Upload, FileText, Eye, Pencil, Trash2 } from 'lucide-react';
import { useTransactions } from '@/context/transactions-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type CustomerSale } from '@/types';

export default function CustomerSalesPage() {
  const searchParams = useSearchParams();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customer, setCustomer] = useState('all_customers');

  const { getTransactionByOperationNumber, customerNames, customerSales, addCustomerSale, deleteCustomerSale, updateCustomerSale, addCustomerPayment, loading } = useTransactions();
  const { toast } = useToast();

  const [newPayment, setNewPayment] = useState({
    customer: '',
    amount: '',
    date: '',
    method: 'cash'
  });

  const [newInvoice, setNewInvoice] = useState({
    customer: '',
    amount: '',
    date: '',
    operationNumber: ''
  });

  const [editingSale, setEditingSale] = useState<CustomerSale | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddingInvoice, setIsAddingInvoice] = useState(false);
  
  useEffect(() => {
    const customerFromUrl = searchParams.get('customer');
    if (customerFromUrl) {
      const decodedCustomer = decodeURIComponent(customerFromUrl);
      setCustomer(decodedCustomer);
      setNewInvoice(prev => ({ ...prev, customer: decodedCustomer }));
      setNewPayment(prev => ({ ...prev, customer: decodedCustomer }));
    }
  }, [searchParams]);

  const filteredSalesData = useMemo(() => {
    const data = customerSales
      .filter(sale => {
        const customerMatch = !customer || customer === 'all_customers' ? true : sale.customerName === customer;
        const dateFromMatch = dateFrom ? new Date(sale.date) >= new Date(dateFrom) : true;
        const dateToMatch = dateTo ? new Date(sale.date) <= new Date(dateTo) : true;
        return customerMatch && dateFromMatch && dateToMatch;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let cumulativePaid = 0;
    return data.map(sale => {
      const payments = customerSales.filter(p => p.customerName === sale.customerName && new Date(p.date) <= new Date(sale.date) && p.paidAmount > 0);
      cumulativePaid = payments.reduce((acc, curr) => acc + curr.paidAmount, 0);

      return {
        ...sale,
        cumulativePaidAmount: cumulativePaid,
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerSales, customer, dateFrom, dateTo]);


  const totals = useMemo(() => {
    const dataToCalculate = filteredSalesData;
    const totalSales = dataToCalculate.filter(s => s.status !== 'رصيد دائن' && s.status !== 'دفعة مقدمة').reduce((sum, sale) => sum + sale.amount, 0);
    const totalPaid = dataToCalculate.reduce((sum, sale) => sum + sale.paidAmount, 0);
    const totalBalance = totalSales - totalPaid;
    return { totalSales, totalPaid, totalBalance };
  }, [filteredSalesData]);


  const handleAddPayment = async () => {
    if (!newPayment.customer || !newPayment.amount || !newPayment.date) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع حقول الدفعة', variant: 'destructive' });
      return;
    }
    const paymentAmount = parseFloat(newPayment.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({ title: 'خطأ', description: 'مبلغ الدفعة غير صحيح', variant: 'destructive' });
      return;
    }

    try {
      await addCustomerPayment({
        customerName: newPayment.customer,
        amount: paymentAmount,
        date: new Date(newPayment.date),
        paymentMethod: newPayment.method as any,
        receivedStatus: 'تم الاستلام',
        notes: `دفعة من العميل ${newPayment.customer}`,
        supplierName: 'المبيعات العامة',
        transactionType: 'payment',
      });
      
      setNewPayment({ customer: newPayment.customer, amount: '', date: '', method: 'cash' });
      toast({ title: 'نجاح', description: 'تم تسجيل الدفعة بنجاح وسيتم تطبيقها على الفواتير.' });
    } catch (error) {
      console.error("Error adding payment:", error);
      toast({ title: 'خطأ', description: 'فشل تسجيل الدفعة', variant: 'destructive' });
    }
  };
  
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'نقداً';
      case 'bank_transfer': return 'تحويل بنكي';
      case 'deposit': return 'إيداع';
      case 'check': return 'شيك';
      default: return method;
    }
  };

  const handleDocumentUpload = (saleId: string, documentUrl: string) => {
    toast({ title: 'نجاح', description: `تم رفع المستند للفاتورة ${saleId}` });
  };

  const handleViewDocument = (documentUrl: string | undefined) => {
    if (documentUrl) {
      window.open(documentUrl, '_blank');
    } else {
      toast({ title: 'لا يوجد مستند', description: 'لا يوجد مستند مرفق لهذه الدفعة', variant: 'destructive' });
    }
  };

  const handleAddInvoice = async () => {
    if (!newInvoice.customer || !newInvoice.amount || !newInvoice.date) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع حقول الفاتورة', variant: 'destructive' });
      return;
    }

    const invoiceAmount = parseFloat(newInvoice.amount);
    if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
      toast({ title: 'خطأ', description: 'يرجى إدخال مبلغ صحيح للفاتورة', variant: 'destructive' });
      return;
    }

    setIsAddingInvoice(true);
    const operationNumber = newInvoice.operationNumber.trim() || `OP-${Date.now()}`;

    try {
      const newSaleData: Omit<CustomerSale, 'id'> = {
        customerName: newInvoice.customer.trim(),
        date: new Date(newInvoice.date),
        amount: invoiceAmount,
        paidAmount: 0,
        status: 'معلق',
        operationNumber: operationNumber,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        supplierName: 'المبيعات العامة', 
        description: `فاتورة مبيعات للعميل ${newInvoice.customer.trim()}`,
      };

      await addCustomerSale(newSaleData);
      
      setNewInvoice({ customer: newInvoice.customer, amount: '', date: '', operationNumber: '' });
      toast({ title: 'نجاح', description: `تم إضافة الفاتورة بنجاح!` });

    } catch (error) {
      console.error('Error adding invoice:', error);
      toast({ title: 'خطأ', description: 'فشل في إضافة الفاتورة', variant: 'destructive' });
    } finally {
      setIsAddingInvoice(false);
    }
  };

  const handleFetchDataByOperationNumber = () => {
    const opNumber = newInvoice.operationNumber.trim();
    if (!opNumber) return;

    const transaction = getTransactionByOperationNumber(opNumber);

    if (transaction) {
      const fetchedCustomerName = transaction.customerName || '';
      setNewInvoice({
        ...newInvoice,
        customer: fetchedCustomerName,
        amount: String(transaction.totalSellingPrice || 0),
        date: format(new Date(transaction.date), 'yyyy-MM-dd'),
      });
      setNewPayment(prev => ({ ...prev, customer: fetchedCustomerName }));
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

  const handleDeleteSale = async (saleId: string) => {
    try {
      await deleteCustomerSale(saleId);
      toast({ title: 'تم الحذف', description: 'تم حذف الفاتورة بنجاح' });
    } catch (error) {
       toast({ title: 'خطأ في الحذف', description: 'لم نتمكن من حذف الفاتورة.', variant: "destructive" });
    }
  };

  const handleOpenEditDialog = (sale: CustomerSale) => {
    setEditingSale(sale);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    try {
      await updateCustomerSale(editingSale);
      toast({ title: 'تم التحديث', description: 'تم تحديث الفاتورة بنجاح' });
      setIsEditDialogOpen(false);
      setEditingSale(null);
    } catch (error) {
      toast({ title: 'خطأ في التحديث', description: 'لم نتمكن من تحديث الفاتورة.', variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto space-y-4 max-w-full">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-bold text-gray-800">أرصدة العملاء</h1>
      </div>

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
                  <SelectItem value="all_customers">جميع العملاء</SelectItem>
                  {customerNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full h-9" onClick={() => { /* Filtering is now automatic */ }}>بحث</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold text-blue-600">
              {totals.totalSales.toLocaleString('ar-EG')} ج.م
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">إجمالي المدفوع</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold text-green-600">
              {totals.totalPaid.toLocaleString('ar-EG')} ج.م
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">الرصيد المتبقي</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold text-red-600">
              {totals.totalBalance.toLocaleString('ar-EG')} ج.م
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
            <CardTitle className="text-sm font-medium">عدد الفواتير</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-3">
            <div className="text-xl font-bold">{filteredSalesData.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">إضافة فاتورة مبيعات جديدة</CardTitle>
          <CardDescription className="text-sm">
            أضف فاتورة مبيعات للعميل (سيتم خصم أي أرصدة دائنة تلقائياً)
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
                onChange={(e) => {
                  const customerName = e.target.value;
                  setNewInvoice({ ...newInvoice, customer: customerName });
                  setNewPayment({ ...newPayment, customer: customerName });
                }}
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
                  <TableHead className="text-right text-sm">الإجمالي المدفوع التراكمي</TableHead>
                  <TableHead className="text-right text-sm">تاريخ الدفع</TableHead>
                  <TableHead className="text-right text-sm">طريقة الدفع</TableHead>
                  <TableHead className="text-right text-sm">الرصيد المتبقي</TableHead>
                  <TableHead className="text-right text-sm">المستندات</TableHead>
                  <TableHead className="text-right text-sm">الحالة</TableHead>
                  <TableHead className="text-right text-sm">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8">
                    جاري تحميل البيانات...
                  </TableCell>
                </TableRow>
              ) : filteredSalesData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="text-lg">📊</div>
                      <div>لا توجد بيانات لعرضها</div>
                      <div className="text-sm">استخدم النموذج أعلاه لإضافة أول فاتورة</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSalesData.map((sale: CustomerSale) => {
                  const remainingBalance = sale.amount - sale.paidAmount;
                  return (
                    <TableRow key={sale.id} className="text-sm">
                      <TableCell className="font-medium text-sm text-blue-600">
                        {sale.operationNumber || '-'}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{sale.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{sale.customerName}</TableCell>
                      <TableCell className="text-sm">{format(new Date(sale.date), 'yyyy-MM-dd')}</TableCell>
                      <TableCell className="text-blue-600 font-semibold text-sm">
                        {sale.amount.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-green-600 font-semibold text-sm">
                        {sale.paidAmount.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-purple-600 font-semibold text-sm">
                        {(sale.cumulativePaidAmount || 0).toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-sm">
                        {sale.paymentDate && sale.paymentDate instanceof Date && !isNaN(new Date(sale.paymentDate).getTime())
                            ? format(new Date(sale.paymentDate), 'yyyy-MM-dd')
                            : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getPaymentMethodText(sale.paymentMethod || '') || '-'}
                      </TableCell>
                      <TableCell className={`font-semibold text-sm ${remainingBalance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {remainingBalance.toLocaleString('ar-EG')} ج.م
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <UploadDialog
                            onUploadComplete={(url) => handleDocumentUpload(sale.id, url)}
                            acceptTypes=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            maxSize={10 * 1024 * 1024}
                            uploadPath={`customer-sales/${sale.id}`}
                          >
                            <Button variant="outline" size="sm" className="flex items-center gap-1 h-7 px-2 text-xs">
                              <Upload className="w-3 h-3" />
                              رفع
                            </Button>
                          </UploadDialog>
                          
                          {sale.documentUrl && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleViewDocument(sale.documentUrl)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 h-7 px-2 text-xs"
                            >
                              <Eye className="w-3 h-3" />
                              عرض
                            </Button>
                          )}
                          
                          {sale.documentUrl ? (
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
                          variant={sale.status === 'مدفوع' ? 'default' : sale.status === 'مدفوع جزئياً' ? 'secondary' : sale.status === 'معلق' ? 'destructive' : 'outline'}
                          className={`text-xs ${
                            sale.status === 'مدفوع'
                              ? 'bg-green-500 hover:bg-green-600'
                              : sale.status === 'مدفوع جزئياً'
                              ? 'bg-yellow-500 hover:bg-yellow-600'
                              : sale.status === 'معلق' ? 'bg-red-500 hover:bg-red-600' : ''
                          }`}
                        >
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(sale)}>
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
                                            سيتم حذف هذه الفاتورة نهائياً. لا يمكن التراجع عن هذا الإجراء.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteSale(sale.id)}>
                                            حذف
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
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
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الفاتورة</DialogTitle>
            <DialogDescription>
              قم بتعديل بيانات الفاتورة أدناه ثم اضغط على حفظ.
            </DialogDescription>
          </DialogHeader>
          {editingSale && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-customerName" className="text-right">
                  اسم العميل
                </Label>
                <Input
                  id="edit-customerName"
                  value={editingSale.customerName}
                  onChange={(e) => setEditingSale({ ...editingSale, customerName: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-date" className="text-right">
                  التاريخ
                </Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={format(new Date(editingSale.date), 'yyyy-MM-dd')}
                  onChange={(e) => setEditingSale({ ...editingSale, date: new Date(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-amount" className="text-right">
                  مبلغ البيع
                </Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={editingSale.amount}
                  onChange={(e) => setEditingSale({ ...editingSale, amount: parseFloat(e.target.value) || 0 })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-paidAmount" className="text-right">
                  المبلغ المدفوع
                </Label>
                <Input
                  id="edit-paidAmount"
                  type="number"
                  value={editingSale.paidAmount}
                  onChange={(e) => setEditingSale({ ...editingSale, paidAmount: parseFloat(e.target.value) || 0 })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  الحالة
                </Label>
                 <Select
                    value={editingSale.status}
                    onValueChange={(value) => setEditingSale({ ...editingSale, status: value as any })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="معلق">معلق</SelectItem>
                      <SelectItem value="مدفوع جزئياً">مدفوع جزئياً</SelectItem>
                      <SelectItem value="مدفوع">مدفوع</SelectItem>
                      <SelectItem value="رصيد دائن">رصيد دائن</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleUpdateSale}>حفظ التعديلات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
