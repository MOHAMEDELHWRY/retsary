"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { type Transaction, type Expense, type BalanceTransfer, type SupplierPayment, type CustomerPayment, type CustomerSale, type CustomerBalance, type InventoryBalance } from '@/types';
import { db, storage } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { 
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable
} from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './auth-context';

// Utility function to remove undefined values from objects for Firebase
const cleanDataForFirebase = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(cleanDataForFirebase).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanDataForFirebase(value);
      }
    }
    return cleaned;
  }
  
  return obj;
};

interface TransactionsContextType {
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<Transaction>;
  updateTransaction: (updatedTransaction: Transaction) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  deleteSupplier: (supplierName: string) => Promise<void>;
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (updatedExpense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  balanceTransfers: BalanceTransfer[];
  addBalanceTransfer: (transfer: Omit<BalanceTransfer, 'id'>) => Promise<void>;
  updateBalanceTransfer: (updatedTransfer: BalanceTransfer) => Promise<void>;
  deleteBalanceTransfer: (transferId: string) => Promise<void>;
  supplierPayments: SupplierPayment[];
  addSupplierPayment: (paymentData: Omit<SupplierPayment, 'id' | 'documentUrl' | 'documentPath'>, file?: File | null) => Promise<void>;
  updateSupplierPayment: (existingPayment: SupplierPayment, paymentData: Omit<SupplierPayment, 'id' | 'documentUrl' | 'documentPath'>, file?: File | null) => Promise<void>;
  deleteSupplierPayment: (payment: SupplierPayment) => Promise<void>;
  customerPayments: CustomerPayment[];
  addCustomerPayment: (payment: Omit<CustomerPayment, 'id'>) => Promise<void>;
  updateCustomerPayment: (updatedPayment: CustomerPayment) => Promise<void>;
  deleteCustomerPayment: (paymentId: string) => Promise<void>;
  confirmCustomerPayment: (paymentId: string, confirmedBy: string) => Promise<void>;
  customerSales: CustomerSale[];
  addCustomerSale: (sale: Omit<CustomerSale, 'id'>) => Promise<void>;
  updateCustomerSale: (updatedSale: CustomerSale) => Promise<void>;
  deleteCustomerSale: (saleId: string) => Promise<void>;
  createCustomerPaymentDataFromTransaction: (transaction: Transaction) => Omit<CustomerPayment, 'id'>;
  createCustomerPaymentFromTransaction: (transaction: Transaction) => Promise<void>;
  getTransactionByOperationNumber: (operationNumber: string) => Transaction | undefined;
  getCustomerBalance: (customerName: string) => CustomerBalance;
  getInventoryBalance: (category: string, variety: string, customerName: string, supplierName: string, governorate: string, city: string) => InventoryBalance | null;
  supplierNames: string[];
  customerNames: string[];
  loading: boolean;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balanceTransfers, setBalanceTransfers] = useState<BalanceTransfer[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSale[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supplierNames = useMemo(() => {
    const allNames = new Set<string>();
    transactions.forEach(t => allNames.add(t.supplierName));
    expenses.forEach(e => { if (e.supplierName) allNames.add(e.supplierName) });
    balanceTransfers.forEach(t => {
      allNames.add(t.fromSupplier);
      allNames.add(t.toSupplier);
    });
    supplierPayments.forEach(p => allNames.add(p.supplierName));
    return Array.from(allNames).sort((a,b) => a.localeCompare(b));
  }, [transactions, expenses, balanceTransfers, supplierPayments]);

  const customerNames = useMemo(() => {
    const allNames = new Set<string>();
    customerPayments.forEach(p => allNames.add(p.customerName));
    customerSales.forEach(s => allNames.add(s.customerName));
    return Array.from(allNames).sort((a,b) => a.localeCompare(b));
  }, [customerPayments, customerSales]);

  const getCustomerBalance = (customerName: string): CustomerBalance => {
    const customerSalesFiltered = customerSales.filter(s => s.customerName === customerName);
    const customerPaymentsFiltered = customerPayments.filter(p => p.customerName === customerName);
    
    const totalSales = customerSalesFiltered.reduce((sum, sale) => sum + sale.amount, 0);
    const totalPayments = customerPaymentsFiltered.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = totalSales - totalPayments;
    
    const allTransactions = [
      ...customerSalesFiltered.map(sale => ({
        type: 'sale' as const,
        date: sale.date,
        amount: sale.amount,
        description: sale.description || '',
        reference: sale.invoiceNumber || ''
      })),
      ...customerPaymentsFiltered.map(payment => ({
        type: 'payment' as const,
        date: payment.date,
        amount: payment.amount,
        description: payment.notes || '',
        reference: payment.referenceNumber || ''
      }))
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    const transactionHistory = allTransactions.map(transaction => {
      if (transaction.type === 'sale') {
        runningBalance += transaction.amount;
      } else {
        runningBalance -= transaction.amount;
      }
      return {
        ...transaction,
        runningBalance
      };
    });

    return {
      customerName,
      totalSales,
      totalPayments,
      balance,
      balanceType: balance > 0 ? 'creditor' : 'debtor'
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setTransactions([]);
        setExpenses([]);
        setBalanceTransfers([]);
        setSupplierPayments([]);
        setCustomerPayments([]);
        setCustomerSales([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const transactionsCollectionRef = collection(db, 'users', currentUser.uid, 'transactions');
        const expensesCollectionRef = collection(db, 'users', currentUser.uid, 'expenses');
        const balanceTransfersCollectionRef = collection(db, 'users', currentUser.uid, 'balanceTransfers');
        const supplierPaymentsCollectionRef = collection(db, 'users', currentUser.uid, 'supplierPayments');
        const customerPaymentsCollectionRef = collection(db, 'users', currentUser.uid, 'customerPayments');
        const customerSalesCollectionRef = collection(db, 'users', currentUser.uid, 'customerSales');
        
        const transactionSnapshot = await getDocs(transactionsCollectionRef);
        const fetchedTransactions = transactionSnapshot.docs.map(doc => {
          const data = doc.data();
          const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
          const executionDate = data.executionDate ? (data.executionDate instanceof Timestamp ? data.executionDate.toDate() : new Date(data.executionDate)) : undefined;
          const dueDate = data.dueDate ? (data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date(data.dueDate)) : undefined;
          
          return {
            ...data,
            id: doc.id,
            date,
            executionDate,
            dueDate,
          } as Transaction;
        });
        setTransactions(fetchedTransactions.sort((a, b) => b.date.getTime() - a.date.getTime()));

        const expenseSnapshot = await getDocs(expensesCollectionRef);
        const fetchedExpenses = expenseSnapshot.docs.map(doc => {
          const data = doc.data();
          const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
          return {
            ...data,
            id: doc.id,
            date,
          } as Expense;
        });
        setExpenses(fetchedExpenses.sort((a, b) => b.date.getTime() - a.date.getTime()));

        const transferSnapshot = await getDocs(balanceTransfersCollectionRef);
        const fetchedTransfers = transferSnapshot.docs.map(doc => {
          const data = doc.data();
          const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
          return {
            ...data,
            id: doc.id,
            date,
            fromAccount: data.fromAccount || 'sales_balance',
            toAccount: data.toAccount || 'sales_balance',
          } as BalanceTransfer;
        });
        setBalanceTransfers(fetchedTransfers.sort((a, b) => b.date.getTime() - a.date.getTime()));

        const paymentSnapshot = await getDocs(supplierPaymentsCollectionRef);
        const fetchedPayments = paymentSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);

          return {
            ...data,
            id: doc.id,
            date,
            classification: data.classification || 'دفعة من رصيد المبيعات', 
          } as SupplierPayment;
        });
        setSupplierPayments(fetchedPayments.sort((a, b) => b.date.getTime() - a.date.getTime()));

        const customerPaymentSnapshot = await getDocs(customerPaymentsCollectionRef);
        const fetchedCustomerPayments = customerPaymentSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          
          // معالجة التاريخ الأساسي مع التحقق من صحته
          let date: Date;
          if (data.date instanceof Timestamp) {
            date = data.date.toDate();
          } else if (data.date) {
            const parsedDate = new Date(data.date);
            date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
          } else {
            date = new Date();
          }
          
          // معالجة تاريخ التأكيد مع التحقق من صحته
          let confirmedDate: Date | undefined;
          if (data.confirmedDate) {
            if (data.confirmedDate instanceof Timestamp) {
              confirmedDate = data.confirmedDate.toDate();
            } else {
              const parsedDate = new Date(data.confirmedDate);
              confirmedDate = isNaN(parsedDate.getTime()) ? undefined : parsedDate;
            }
          }

          // معالجة تاريخ الخروج مع التحقق من صحته
          let departureDate: Date | undefined;
          if (data.departureDate) {
            if (data.departureDate instanceof Timestamp) {
              departureDate = data.departureDate.toDate();
            } else {
              const parsedDate = new Date(data.departureDate);
              departureDate = isNaN(parsedDate.getTime()) ? undefined : parsedDate;
            }
          }

          return {
            ...data,
            id: doc.id,
            date,
            confirmedDate,
            departureDate,
            receivedStatus: data.receivedStatus || 'في الانتظار',
          } as CustomerPayment;
        });
        setCustomerPayments(fetchedCustomerPayments.sort((a, b) => b.date.getTime() - a.date.getTime()));

        const customerSalesSnapshot = await getDocs(customerSalesCollectionRef);
        const fetchedCustomerSales = customerSalesSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          
          // معالجة التاريخ مع التحقق من صحته
          let date: Date;
          if (data.date instanceof Timestamp) {
            date = data.date.toDate();
          } else if (data.date) {
            const parsedDate = new Date(data.date);
            date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
          } else {
            date = new Date();
          }

          return {
            ...data,
            id: doc.id,
            date,
          } as CustomerSale;
        });
        setCustomerSales(fetchedCustomerSales.sort((a, b) => b.date.getTime() - a.date.getTime()));


      } catch (error) {
        console.error("Could not fetch data from Firestore", error);
        toast({ title: "خطأ", description: "لم نتمكن من تحميل البيانات من قاعدة البيانات.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const addTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const transactionsCollectionRef = collection(db, 'users', currentUser.uid, 'transactions');
      const docData = cleanDataForFirebase({
        ...transaction,
        date: Timestamp.fromDate(transaction.date),
        executionDate: transaction.executionDate ? Timestamp.fromDate(transaction.executionDate) : null,
        dueDate: transaction.dueDate ? Timestamp.fromDate(transaction.dueDate) : null,
      });
      const docRef = await addDoc(transactionsCollectionRef, docData);
      const newTransaction = { ...transaction, id: docRef.id };
      setTransactions(prev => [newTransaction, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));
      return newTransaction;
    } catch (error) {
      console.error("Error adding transaction: ", error);
      throw error;
    }
  };

  const updateTransaction = async (updatedTransaction: Transaction) => {
    if (!currentUser) throw new Error("User not authenticated");
     try {
      const { id, ...dataToUpdate } = updatedTransaction;
      const transactionDoc = doc(db, 'users', currentUser.uid, 'transactions', id);
      const docData = cleanDataForFirebase({
        ...dataToUpdate,
        date: Timestamp.fromDate(updatedTransaction.date),
        executionDate: updatedTransaction.executionDate ? Timestamp.fromDate(updatedTransaction.executionDate) : null,
        dueDate: updatedTransaction.dueDate ? Timestamp.fromDate(updatedTransaction.dueDate) : null,
      });
      await updateDoc(transactionDoc, docData);
      setTransactions(prev => 
        prev.map(t => (t.id === updatedTransaction.id ? updatedTransaction : t))
           .sort((a, b) => b.date.getTime() - a.date.getTime())
      );
    } catch (error) {
      console.error("Error updating transaction: ", error);
      throw error;
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    if (!currentUser) return;
    try {
      const transactionDoc = doc(db, 'users', currentUser.uid, 'transactions', transactionId);
      await deleteDoc(transactionDoc);
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      toast({
        title: "تم الحذف",
        description: "تم حذف العملية بنجاح.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting transaction: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف العملية.", variant: "destructive" });
    }
  };

  const deleteSupplier = async (supplierName: string) => {
    if (!currentUser) return;
     try {
      const transactionsCollectionRef = collection(db, 'users', currentUser.uid, 'transactions');
      const batch = writeBatch(db);
      const q = query(transactionsCollectionRef, where("supplierName", "==", supplierName));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
      });
      
      await batch.commit();

      setTransactions(prev => prev.filter(t => t.supplierName !== supplierName));
      toast({
        title: 'تم الحذف',
        description: `تم حذف المورد "${supplierName}" وجميع عملياته بنجاح.`,
        variant: 'default',
      });
    } catch (error) {
       console.error("Error deleting supplier transactions: ", error);
       toast({ title: "خطأ", description: "لم نتمكن من حذف عمليات المورد.", variant: "destructive" });
    }
  };
  
  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const expensesCollectionRef = collection(db, 'users', currentUser.uid, 'expenses');
      const docData = cleanDataForFirebase({
        ...expense,
        date: Timestamp.fromDate(expense.date),
      });
      const docRef = await addDoc(expensesCollectionRef, docData);
      setExpenses(prev => [{...expense, id: docRef.id }, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));
    } catch (error) {
      console.error("Error adding expense: ", error);
      throw error;
    }
  };

  const updateExpense = async (updatedExpense: Expense) => {
    if (!currentUser) throw new Error("User not authenticated");
     try {
      const { id, ...dataToUpdate } = updatedExpense;
      const expenseDoc = doc(db, 'users', currentUser.uid, 'expenses', id);
      const docData = {
        ...dataToUpdate,
        date: Timestamp.fromDate(updatedExpense.date),
      };
      await updateDoc(expenseDoc, docData);
      setExpenses(prev => 
        prev.map(e => (e.id === updatedExpense.id ? updatedExpense : e))
           .sort((a, b) => b.date.getTime() - a.date.getTime())
      );
    } catch (error) {
      console.error("Error updating expense: ", error);
      throw error;
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!currentUser) return;
    try {
      const expenseDoc = doc(db, 'users', currentUser.uid, 'expenses', expenseId);
      await deleteDoc(expenseDoc);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      toast({
        title: "تم الحذف",
        description: "تم حذف المصروف بنجاح.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting expense: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف المصروف.", variant: "destructive" });
    }
  };

  const addBalanceTransfer = async (transfer: Omit<BalanceTransfer, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const transfersCollectionRef = collection(db, 'users', currentUser.uid, 'balanceTransfers');
      const docData = cleanDataForFirebase({
        ...transfer,
        date: Timestamp.fromDate(transfer.date),
      });
      const docRef = await addDoc(transfersCollectionRef, docData);
      setBalanceTransfers(prev => [{ ...transfer, id: docRef.id }, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));
      
      if (transfer.fromAccount === 'profit_expense') {
        const expenseData: Omit<Expense, 'id'> = {
          date: transfer.date,
          description: `تحويل رصيد إلى ${transfer.toSupplier}: ${transfer.reason}`,
          amount: transfer.amount,
          supplierName: transfer.fromSupplier
        };
        await addExpense(expenseData);
      }

    } catch (error) {
      console.error("Error adding balance transfer: ", error);
      throw error;
    }
  };

  const updateBalanceTransfer = async (updatedTransfer: BalanceTransfer) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const { id, ...dataToUpdate } = updatedTransfer;
      const transferDoc = doc(db, 'users', currentUser.uid, 'balanceTransfers', id);
      const docData = {
        ...dataToUpdate,
        date: Timestamp.fromDate(updatedTransfer.date),
      };
      await updateDoc(transferDoc, docData);
      setBalanceTransfers(prev =>
        prev.map(t => (t.id === updatedTransfer.id ? updatedTransfer : t))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      );
    } catch (error) {
      console.error("Error updating balance transfer: ", error);
      throw error;
    }
  };

  const deleteBalanceTransfer = async (transferId: string) => {
    if (!currentUser) return;
    try {
      const transferDocRef = doc(db, 'users', currentUser.uid, 'balanceTransfers', transferId);
      const transferDoc = await getDoc(transferDocRef);
      const transferData = transferDoc.data() as BalanceTransfer;
      
      await deleteDoc(transferDocRef);
      
      setBalanceTransfers(prev => prev.filter(t => t.id !== transferId));

      if (transferData.fromAccount === 'profit_expense') {
        toast({ title: "تنبيه", description: "تم حذف التحويل، لكن قد تحتاج لحذف المصروف المرتبط به يدويًا."})
      }

      toast({
        title: "تم الحذف",
        description: "تم حذف عملية التحويل بنجاح.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting balance transfer: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف عملية التحويل.", variant: "destructive" });
    }
  };

  const MAX_RETRIES = 5; // زيادة عدد المحاولات
  const RETRY_DELAY = 3000; // زيادة وقت الانتظار بين المحاولات (3 ثواني)
  
  const uploadDocument = async (file: File, paymentId: string): Promise<{ url: string; path: string }> => {
    if (!currentUser) throw new Error("يجب تسجيل الدخول أولاً");
    
    // التحقق من حجم الملف (5MB كحد أقصى)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('حجم الملف كبير جداً. الحد الأقصى هو 5 ميجابايت');
    }

    // التحقق من نوع الملف
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      throw new Error('نوع الملف غير مدعوم. يرجى رفع صور أو ملفات PDF فقط');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // إضافة timestamp للتأكد من عدم تكرار أسماء الملفات
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `users/${currentUser.uid}/payments/${paymentId}/${timestamp}_${safeFileName}`;
        const fileRef = ref(storage, filePath);

        // محاولة الرفع باستخدام uploadBytes أولاً
        await uploadBytes(fileRef, file, {
          contentType: file.type,
          customMetadata: {
            paymentId,
            uploadTime: new Date().toISOString(),
            attempt: String(attempt + 1),
            originalName: file.name
          }
        });

        // بعد نجاح الرفع، نحصل على رابط التحميل
        const downloadURL = await getDownloadURL(fileRef);
        
        return {
          url: downloadURL,
          path: filePath
        };

      } catch (error: any) {
        lastError = error;
        console.error(`محاولة الرفع ${attempt + 1} فشلت:`, error);

        if (error.code === 'storage/unknown' || error.code === 'storage/retry-limit-exceeded') {
          // انتظار قبل المحاولة التالية
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          console.log(`انتظار ${delay/1000} ثواني قبل إعادة المحاولة...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // إذا كان الخطأ ليس متعلقاً بـ CORS أو الاتصال، نتوقف عن المحاولة
        throw new Error(
          error.code === 'storage/unauthorized' 
            ? 'غير مصرح لك برفع الملفات. يرجى تسجيل الدخول مرة أخرى.'
            : 'حدث خطأ أثناء رفع الملف. يرجى المحاولة مرة أخرى.'
        );
      }
    }

    throw lastError || new Error('فشل رفع الملف بعد عدة محاولات. يرجى المحاولة مرة أخرى لاحقاً.');
  };
  
  const addSupplierPayment = async (paymentData: Omit<SupplierPayment, 'id' | 'documentUrl' | 'documentPath'>, file: File | null = null) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    // Generate the document reference
    const paymentDocRef = doc(collection(db, 'users', currentUser.uid, 'supplierPayments'));
    const paymentId = paymentDocRef.id;
    let documentInfo: { documentUrl?: string; documentPath?: string } = {};

    try {
      // Create payment document first for better UX
      const initialPaymentData = {
        ...paymentData,
        date: Timestamp.fromDate(paymentData.date),
        status: file ? 'uploading' : 'completed',
      };

      // Save initial payment data
      await setDoc(paymentDocRef, initialPaymentData);

      // Handle file upload if exists
      if (file) {
        try {
          const uploadResult = await uploadDocument(file, paymentId);
          documentInfo = {
            documentUrl: uploadResult.url,
            documentPath: uploadResult.path
          };
          // Update document with file info and status
          await updateDoc(paymentDocRef, {
            ...documentInfo,
            status: 'completed'
          });
        } catch (uploadError) {
          console.error('Upload failed:', uploadError);
          // Update document to indicate upload failure but keep the payment
          await updateDoc(paymentDocRef, { status: 'upload_failed' });
          throw new Error('تم حفظ الدفعة ولكن فشل رفع المستند. يمكنك تعديل الدفعة لإعادة رفع المستند.');
        }
      }
      
      const finalPaymentData = {
        ...paymentData,
        ...documentInfo,
        date: Timestamp.fromDate(paymentData.date),
      };
      
      await setDoc(paymentDocRef, finalPaymentData);

      const newPayment = { ...paymentData, ...documentInfo, id: paymentId } as SupplierPayment;
      setSupplierPayments(prev => [newPayment, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));

    } catch (error) {
      console.error("Error in addSupplierPayment: ", error);
      throw error;
    }
  };
  
  const updateSupplierPayment = async (existingPayment: SupplierPayment, paymentData: Omit<SupplierPayment, 'id'>, file: File | null = null) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    const paymentDocRef = doc(db, 'users', currentUser.uid, 'supplierPayments', existingPayment.id);
    const updatedData: Partial<SupplierPayment> = { 
      ...paymentData,
      status: file ? 'uploading' : paymentData.status || 'completed'
    };

    try {
      // Handle file upload/replacement
      if (file) {
        // If a new file is uploaded, delete the old one first if it exists
        if (existingPayment.documentPath) {
          const oldFileRef = ref(storage, existingPayment.documentPath);
          await deleteObject(oldFileRef).catch(error => console.warn("Old file not found, proceeding.", error));
        }
        const { url, path } = await uploadDocument(file, existingPayment.id);
        updatedData.documentUrl = url;
        updatedData.documentPath = path;
      } else if (existingPayment.documentPath && existingPayment.documentUrl) {
          // This indicates the user removed the existing document without uploading a new one
          const oldFileRef = ref(storage, existingPayment.documentPath);
          await deleteObject(oldFileRef).catch(error => console.warn("Old file not found, proceeding.", error));
          updatedData.documentUrl = undefined;
          updatedData.documentPath = undefined;
      }

      const finalDataToUpdate = {
        ...updatedData,
        date: Timestamp.fromDate(paymentData.date),
      };

      await updateDoc(paymentDocRef, finalDataToUpdate);
      
      const updatedLocalPayment = { ...existingPayment, ...finalDataToUpdate, date: paymentData.date };

      setSupplierPayments(prev => prev.map(p => 
          p.id === existingPayment.id ? updatedLocalPayment : p
      ).sort((a,b) => b.date.getTime() - a.date.getTime()));
    } catch(error) {
       console.error("Error in updateSupplierPayment: ", error);
       throw error;
    }
  };
  
  const deleteSupplierPayment = async (payment: SupplierPayment) => {
    if (!currentUser) return;
    const paymentDocRef = doc(db, 'users', currentUser.uid, 'supplierPayments', payment.id);
    
    try {
        await deleteDoc(paymentDocRef);
        if (payment.documentPath) {
            const fileRef = ref(storage, payment.documentPath);
            await deleteObject(fileRef).catch(error => console.warn("File to delete not found, proceeding.", error));
        }
        setSupplierPayments(prev => prev.filter(p => p.id !== payment.id));
        toast({ title: "تم الحذف", description: "تم حذف الدفعة ومستندها المرفق بنجاح." });
    } catch (error) {
        console.error("Error deleting supplier payment: ", error);
        toast({ title: "خطأ", description: "لم نتمكن من حذف الدفعة.", variant: "destructive" });
    }
  };

  // Customer Payment Functions
  const addCustomerPayment = async (payment: Omit<CustomerPayment, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const customerPaymentsCollectionRef = collection(db, 'users', currentUser.uid, 'customerPayments');
      const docData = cleanDataForFirebase({
        ...payment,
        date: Timestamp.fromDate(payment.date),
        confirmedDate: payment.confirmedDate ? Timestamp.fromDate(payment.confirmedDate) : null,
      });
      const docRef = await addDoc(customerPaymentsCollectionRef, docData);
      setCustomerPayments(prev => [{ ...payment, id: docRef.id }, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));
      toast({ title: "تم الإضافة", description: "تم إضافة مدفوعة العميل بنجاح." });
    } catch (error) {
      console.error("Error adding customer payment: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من إضافة مدفوعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  const updateCustomerPayment = async (updatedPayment: CustomerPayment) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const paymentDocRef = doc(db, 'users', currentUser.uid, 'customerPayments', updatedPayment.id);
      const docData = cleanDataForFirebase({
        ...updatedPayment,
        date: Timestamp.fromDate(updatedPayment.date),
        confirmedDate: updatedPayment.confirmedDate ? Timestamp.fromDate(updatedPayment.confirmedDate) : null,
      });
      await updateDoc(paymentDocRef, docData);
      setCustomerPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p).sort((a, b) => b.date.getTime() - a.date.getTime()));
      toast({ title: "تم التحديث", description: "تم تحديث مدفوعة العميل بنجاح." });
    } catch (error) {
      console.error("Error updating customer payment: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من تحديث مدفوعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  const deleteCustomerPayment = async (paymentId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const paymentDocRef = doc(db, 'users', currentUser.uid, 'customerPayments', paymentId);
      await deleteDoc(paymentDocRef);
      setCustomerPayments(prev => prev.filter(p => p.id !== paymentId));
      toast({ title: "تم الحذف", description: "تم حذف مدفوعة العميل بنجاح." });
    } catch (error) {
      console.error("Error deleting customer payment: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف مدفوعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  const confirmCustomerPayment = async (paymentId: string, confirmedBy: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const paymentDocRef = doc(db, 'users', currentUser.uid, 'customerPayments', paymentId);
      const updatedData = {
        receivedStatus: 'تم الاستلام',
        confirmedDate: Timestamp.fromDate(new Date()),
        confirmedBy: confirmedBy,
      };
      await updateDoc(paymentDocRef, updatedData);
      setCustomerPayments(prev => prev.map(p => p.id === paymentId ? { 
        ...p, 
        receivedStatus: 'تم الاستلام' as const,
        confirmedDate: new Date(),
        confirmedBy: confirmedBy
      } : p));
      toast({ title: "تم التأكيد", description: "تم تأكيد استلام مدفوعة العميل بنجاح." });
    } catch (error) {
      console.error("Error confirming customer payment: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من تأكيد استلام المدفوعة.", variant: "destructive" });
      throw error;
    }
  };

  const addCustomerSale = async (sale: Omit<CustomerSale, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const customerSalesCollectionRef = collection(db, 'users', currentUser.uid, 'customerSales');
      const docData = cleanDataForFirebase({
        ...sale,
        date: Timestamp.fromDate(sale.date),
      });
      const docRef = await addDoc(customerSalesCollectionRef, docData);
      setCustomerSales(prev => [{ ...sale, id: docRef.id }, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));
      toast({ title: "تم الإضافة", description: "تم إضافة مبيعة العميل بنجاح." });
    } catch (error) {
      console.error("Error adding customer sale: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من إضافة مبيعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  const updateCustomerSale = async (updatedSale: CustomerSale) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const { id, ...dataToUpdate } = updatedSale;
      const saleDocRef = doc(db, 'users', currentUser.uid, 'customerSales', id);
      const docData = cleanDataForFirebase({
        ...dataToUpdate,
        date: Timestamp.fromDate(updatedSale.date),
      });
      await updateDoc(saleDocRef, docData);
      setCustomerSales(prev => prev.map(s => s.id === id ? updatedSale : s).sort((a, b) => b.date.getTime() - a.date.getTime()));
      toast({ title: "تم التحديث", description: "تم تحديث مبيعة العميل بنجاح." });
    } catch (error) {
      console.error("Error updating customer sale: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من تحديث مبيعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  const deleteCustomerSale = async (saleId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const saleDocRef = doc(db, 'users', currentUser.uid, 'customerSales', saleId);
      await deleteDoc(saleDocRef);
      setCustomerSales(prev => prev.filter(s => s.id !== saleId));
      toast({ title: "تم الحذف", description: "تم حذف مبيعة العميل بنجاح." });
    } catch (error) {
      console.error("Error deleting customer sale: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف مبيعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  // دالة لإنشاء بيانات مدفوعة من عملية دون حفظها
  const createCustomerPaymentDataFromTransaction = (transaction: Transaction): Omit<CustomerPayment, 'id'> => {
    return {
      date: new Date(),
      customerName: transaction.customerName || '',
      supplierName: transaction.supplierName,
      amount: transaction.totalSellingPrice || 0,
      paymentMethod: 'نقدي',
      receivedStatus: 'في الانتظار',
      
      // البيانات المسحوبة من العملية
      operationNumber: transaction.operationNumber,
      governorate: transaction.governorate,
      city: transaction.city,
      description: transaction.description,
      quantity: transaction.quantity,
      sellingPrice: transaction.sellingPrice,
      
      notes: `مدفوعة تم إنشاؤها تلقائياً من العملية رقم: ${transaction.operationNumber || transaction.id}`,
    };
  };

  // دالة لإنشاء مدفوعة عميل من عملية وحفظها
  const createCustomerPaymentFromTransaction = async (transaction: Transaction): Promise<void> => {
    const paymentData = createCustomerPaymentDataFromTransaction(transaction);
    await addCustomerPayment(paymentData);
  };

  // دالة للبحث عن عملية برقم العملية
  const getTransactionByOperationNumber = (operationNumber: string): Transaction | undefined => {
    return transactions.find(t => t.operationNumber === operationNumber);
  };

  // دالة لحساب رصيد المخزون التراكمي
  const getInventoryBalance = (
    category: string, 
    variety: string, 
    customerName: string, 
    supplierName: string, 
    governorate: string, 
    city: string
  ): InventoryBalance | null => {
    const relatedTransactions = transactions.filter(t => 
      (t.category === category || (!t.category && !category)) &&
      (t.variety === variety || (!t.variety && !variety)) &&
      (t.customerName === customerName || (!t.customerName && !customerName)) &&
      t.supplierName === supplierName &&
      (t.governorate === governorate || (!t.governorate && !governorate)) &&
      (t.city === city || (!t.city && !city))
    );

    if (relatedTransactions.length === 0) {
      return null;
    }

    const totalQuantity = relatedTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalAmount = relatedTransactions.reduce((sum, t) => sum + (t.totalPurchasePrice || 0), 0);
    const actualQuantityDeducted = relatedTransactions.reduce((sum, t) => sum + (t.actualQuantityDeducted || 0), 0);
    const remainingQuantity = totalQuantity - actualQuantityDeducted;
    const remainingAmount = relatedTransactions.reduce((sum, t) => sum + (t.remainingAmount || 0), 0);
    
    const lastTransaction = relatedTransactions.sort((a, b) => b.date.getTime() - a.date.getTime())[0];

    return {
      id: `${category}-${variety}-${customerName}-${supplierName}-${governorate}-${city}`,
      category,
      variety,
      customerName,
      supplierName,
      governorate,
      city,
      totalQuantity,
      totalAmount,
      actualQuantityDeducted,
      remainingQuantity,
      remainingAmount,
      lastTransactionDate: lastTransaction.date,
      lastTransactionNumber: lastTransaction.transactionNumber || lastTransaction.operationNumber
    };
  };


  return (
    <TransactionsContext.Provider value={{ 
      transactions, addTransaction, updateTransaction, deleteTransaction, deleteSupplier, 
      expenses, addExpense, updateExpense, deleteExpense,
      balanceTransfers, addBalanceTransfer, updateBalanceTransfer, deleteBalanceTransfer,
      supplierPayments, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment,
      customerPayments, addCustomerPayment, updateCustomerPayment, deleteCustomerPayment, confirmCustomerPayment,
      customerSales, addCustomerSale, updateCustomerSale, deleteCustomerSale,
      createCustomerPaymentDataFromTransaction,
      createCustomerPaymentFromTransaction,
      getTransactionByOperationNumber,
      getCustomerBalance,
      getInventoryBalance,
      supplierNames,
      customerNames,
      loading 
    }}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionsContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionsProvider');
  }
  return context;
}
