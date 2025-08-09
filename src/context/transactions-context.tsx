

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { type Transaction, type Expense, type BalanceTransfer, type SupplierPayment, type CustomerPayment, type CustomerSale, type CustomerBalance, type InventoryBalance, type Supplier, type Customer } from '@/types';
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
import { format } from 'date-fns';

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
  
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (updatedExpense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;

  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<void>;
  updateSupplier: (updatedSupplier: Supplier) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;

  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<void>;
  updateCustomer: (updatedCustomer: Customer) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [balanceTransfers, setBalanceTransfers] = useState<BalanceTransfer[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSale[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supplierNames = useMemo(() => {
    return suppliers.map(s => s.name).sort((a, b) => a.localeCompare(b));
  }, [suppliers]);
  
  const customerNames = useMemo(() => {
    return customers.map(c => c.name).sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const getCustomerBalance = (customerName: string): CustomerBalance => {
    const customerTransactions = transactions.filter(
      (t) => t.customerName === customerName
    );
    const customerPaymentsFiltered = customerPayments.filter(
      (p) => p.customerName === customerName
    );

    const totalSales = customerTransactions.reduce(
      (sum, t) => sum + (t.totalSellingPrice || 0),
      0
    );
    const totalPayments = customerPaymentsFiltered.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    const balance = totalSales - totalPayments;
    let balanceType: 'debtor' | 'creditor' | 'balanced' = 'balanced';
    if (balance > 0) {
      balanceType = 'debtor'; // Customer owes money
    } else if (balance < 0) {
      balanceType = 'creditor'; // Customer has credit
    }

    return {
      customerName,
      totalSales,
      totalPayments,
      balance,
      balanceType,
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setTransactions([]);
        setExpenses([]);
        setSuppliers([]);
        setCustomers([]);
        setBalanceTransfers([]);
        setSupplierPayments([]);
        setCustomerPayments([]);
        setCustomerSales([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const collections = {
          transactions: collection(db, 'users', currentUser.uid, 'transactions'),
          expenses: collection(db, 'users', currentUser.uid, 'expenses'),
          suppliers: collection(db, 'users', currentUser.uid, 'suppliers'),
          customers: collection(db, 'users', currentUser.uid, 'customers'),
          balanceTransfers: collection(db, 'users', currentUser.uid, 'balanceTransfers'),
          supplierPayments: collection(db, 'users', currentUser.uid, 'supplierPayments'),
          customerPayments: collection(db, 'users', currentUser.uid, 'customerPayments'),
          customerSales: collection(db, 'users', currentUser.uid, 'customerSales'),
        };

        const [
          transactionSnapshot, 
          expenseSnapshot, 
          supplierSnapshot,
          customerSnapshot,
          transferSnapshot, 
          paymentSnapshot, 
          customerPaymentSnapshot, 
          customerSalesSnapshot
        ] = await Promise.all([
          getDocs(collections.transactions),
          getDocs(collections.expenses),
          getDocs(collections.suppliers),
          getDocs(collections.customers),
          getDocs(collections.balanceTransfers),
          getDocs(collections.supplierPayments),
          getDocs(collections.customerPayments),
          getDocs(collections.customerSales),
        ]);
        
        const fetchedTransactions = transactionSnapshot.docs.map(doc => {
          const data = doc.data();
          const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
          const executionDate = data.executionDate ? (data.executionDate instanceof Timestamp ? data.executionDate.toDate() : new Date(data.executionDate)) : undefined;
          const dueDate = data.dueDate ? (data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date(data.dueDate)) : undefined;
          const transactionDate = data.transactionDate ? (data.transactionDate instanceof Timestamp ? data.transactionDate.toDate() : new Date(data.transactionDate)) : undefined;
          const departureDate = data.departureDate ? (data.departureDate instanceof Timestamp ? data.departureDate.toDate() : new Date(data.departureDate)) : undefined;
          const dateReceivedFromCustomer = data.dateReceivedFromCustomer ? (data.dateReceivedFromCustomer instanceof Timestamp ? data.dateReceivedFromCustomer.toDate() : new Date(data.dateReceivedFromCustomer)) : undefined;
          const datePaidToFactory = data.datePaidToFactory ? (data.datePaidToFactory instanceof Timestamp ? data.datePaidToFactory.toDate() : new Date(data.datePaidToFactory)) : undefined;
          const dateReceivedFromSupplier = data.dateReceivedFromSupplier ? (data.dateReceivedFromSupplier instanceof Timestamp ? data.dateReceivedFromSupplier.toDate() : new Date(data.dateReceivedFromSupplier)) : undefined;
          
          return {
            ...data,
            id: doc.id,
            date,
            executionDate,
            dueDate,
            transactionDate,
            departureDate,
            dateReceivedFromCustomer,
            datePaidToFactory,
            dateReceivedFromSupplier,
          } as Transaction;
        });
        setTransactions(fetchedTransactions.sort((a, b) => b.date.getTime() - a.date.getTime()));

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

        const fetchedSuppliers = supplierSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Supplier));
        setSuppliers(fetchedSuppliers.sort((a, b) => a.name.localeCompare(b.name)));
        
        const fetchedCustomers = customerSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Customer));
        setCustomers(fetchedCustomers.sort((a, b) => a.name.localeCompare(b.name)));

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

        const fetchedCustomerPayments = customerPaymentSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          
          let date: Date;
          if (data.date instanceof Timestamp) date = data.date.toDate();
          else date = data.date ? new Date(data.date) : new Date();
          
          let confirmedDate: Date | undefined;
          if (data.confirmedDate) confirmedDate = data.confirmedDate instanceof Timestamp ? data.confirmedDate.toDate() : new Date(data.confirmedDate);

          let departureDate: Date | undefined;
          if (data.departureDate) departureDate = data.departureDate instanceof Timestamp ? data.departureDate.toDate() : new Date(data.departureDate);

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

        const fetchedCustomerSales = customerSalesSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          let date: Date;
          if (data.date instanceof Timestamp) date = data.date.toDate();
          else date = data.date ? new Date(data.date) : new Date();

          let paymentDate: Date | undefined = undefined;
          if (data.paymentDate) {
            paymentDate = data.paymentDate instanceof Timestamp ? data.paymentDate.toDate() : new Date(data.paymentDate);
          }
          
          return { ...data, id: doc.id, date, paymentDate } as CustomerSale;
        });
        setCustomerSales(fetchedCustomerSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));


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
        executionDate: transaction.executionDate ? Timestamp.fromDate(transaction.executionDate) : undefined,
        dueDate: transaction.dueDate ? Timestamp.fromDate(transaction.dueDate) : undefined,
        datePaidToFactory: transaction.datePaidToFactory ? Timestamp.fromDate(transaction.datePaidToFactory) : undefined,
        dateReceivedFromSupplier: transaction.dateReceivedFromSupplier ? Timestamp.fromDate(transaction.dateReceivedFromSupplier) : undefined,
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
        executionDate: updatedTransaction.executionDate ? Timestamp.fromDate(updatedTransaction.executionDate) : undefined,
        dueDate: updatedTransaction.dueDate ? Timestamp.fromDate(updatedTransaction.dueDate) : undefined,
        datePaidToFactory: updatedTransaction.datePaidToFactory ? Timestamp.fromDate(updatedTransaction.datePaidToFactory) : undefined,
        dateReceivedFromSupplier: updatedTransaction.dateReceivedFromSupplier ? Timestamp.fromDate(updatedTransaction.dateReceivedFromSupplier) : undefined,
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
      toast({ title: "تم الحذف", description: "تم حذف العملية بنجاح." });
    } catch (error) {
      console.error("Error deleting transaction: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف العملية.", variant: "destructive" });
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
      toast({ title: "تم الحذف", description: "تم حذف المصروف بنجاح." });
    } catch (error) {
      console.error("Error deleting expense: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف المصروف.", variant: "destructive" });
    }
  };

  const addSupplier = async (supplier: Omit<Supplier, 'id'>) => {
      if (!currentUser) throw new Error("User not authenticated");
      const suppliersCollectionRef = collection(db, 'users', currentUser.uid, 'suppliers');
      const docRef = await addDoc(suppliersCollectionRef, supplier);
      setSuppliers(prev => [...prev, { id: docRef.id, ...supplier }].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const updateSupplier = async (updatedSupplier: Supplier) => {
      if (!currentUser) throw new Error("User not authenticated");
      const { id, ...dataToUpdate } = updatedSupplier;
      const supplierDoc = doc(db, 'users', currentUser.uid, 'suppliers', id);
      await updateDoc(supplierDoc, dataToUpdate);
      setSuppliers(prev => prev.map(s => (s.id === id ? updatedSupplier : s)).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const deleteSupplier = async (supplierId: string) => {
      if (!currentUser) throw new Error("User not authenticated");
      const supplierDoc = doc(db, 'users', currentUser.uid, 'suppliers', supplierId);
      await deleteDoc(supplierDoc);
      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
  };
  
  const addCustomer = async (customer: Omit<Customer, 'id'>) => {
      if (!currentUser) throw new Error("User not authenticated");
      const customersCollectionRef = collection(db, 'users', currentUser.uid, 'customers');
      const docRef = await addDoc(customersCollectionRef, customer);
      setCustomers(prev => [...prev, { id: docRef.id, ...customer }].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const updateCustomer = async (updatedCustomer: Customer) => {
      if (!currentUser) throw new Error("User not authenticated");
      const { id, ...dataToUpdate } = updatedCustomer;
      const customerDoc = doc(db, 'users', currentUser.uid, 'customers', id);
      await updateDoc(customerDoc, dataToUpdate);
      setCustomers(prev => prev.map(s => (s.id === id ? updatedCustomer : s)).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const deleteCustomer = async (customerId: string) => {
      if (!currentUser) throw new Error("User not authenticated");
      const customerDoc = doc(db, 'users', currentUser.uid, 'customers', customerId);
      await deleteDoc(customerDoc);
      setCustomers(prev => prev.filter(s => s.id !== customerId));
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

      toast({ title: "تم الحذف", description: "تم حذف عملية التحويل بنجاح." });
    } catch (error) {
      console.error("Error deleting balance transfer: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف عملية التحويل.", variant: "destructive" });
    }
  };

  const MAX_RETRIES = 5; 
  const RETRY_DELAY = 3000;
  
  const uploadDocument = async (file: File, paymentId: string): Promise<{ url: string; path: string }> => {
    if (!currentUser) throw new Error("يجب تسجيل الدخول أولاً");
    if (file.size > 5 * 1024 * 1024) throw new Error('حجم الملف كبير جداً. الحد الأقصى هو 5 ميجابايت');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('نوع الملف غير مدعوم. يرجى رفع صور أو ملفات PDF فقط');

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `users/${currentUser.uid}/payments/${paymentId}/${timestamp}_${safeFileName}`;
        const fileRef = ref(storage, filePath);
        await uploadBytes(fileRef, file, { contentType: file.type, customMetadata: { paymentId, uploadTime: new Date().toISOString(), attempt: String(attempt + 1), originalName: file.name } });
        const downloadURL = await getDownloadURL(fileRef);
        return { url: downloadURL, path: filePath };
      } catch (error: any) {
        lastError = error;
        console.error(`محاولة الرفع ${attempt + 1} فشلت:`, error);
        if (error.code === 'storage/unknown' || error.code === 'storage/retry-limit-exceeded') {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(error.code === 'storage/unauthorized' ? 'غير مصرح لك برفع الملفات.' : 'حدث خطأ أثناء رفع الملف.');
      }
    }
    throw lastError || new Error('فشل رفع الملف بعد عدة محاولات.');
  };
  
  const addSupplierPayment = async (paymentData: Omit<SupplierPayment, 'id' | 'documentUrl' | 'documentPath'>, file: File | null = null) => {
    if (!currentUser) throw new Error("User not authenticated");
    const paymentDocRef = doc(collection(db, 'users', currentUser.uid, 'supplierPayments'));
    const paymentId = paymentDocRef.id;
    let documentInfo: { documentUrl?: string; documentPath?: string } = {};

    try {
      const docData = cleanDataForFirebase({
          ...paymentData,
          date: Timestamp.fromDate(paymentData.date),
          status: file ? 'uploading' : 'completed'
      });
      await setDoc(paymentDocRef, docData);

      if (file) {
        try {
          const uploadResult = await uploadDocument(file, paymentId);
          documentInfo = { documentUrl: uploadResult.url, documentPath: uploadResult.path };
          await updateDoc(paymentDocRef, { ...documentInfo, status: 'completed' });
        } catch (uploadError) {
          await updateDoc(paymentDocRef, { status: 'upload_failed' });
          throw new Error('تم حفظ الدفعة ولكن فشل رفع المستند.');
        }
      }
      
      const finalPaymentData = { ...paymentData, ...documentInfo, date: Timestamp.fromDate(paymentData.date) };
      await updateDoc(paymentDocRef, cleanDataForFirebase(finalPaymentData));

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
    const updatedData: Partial<SupplierPayment> = { ...paymentData, status: file ? 'uploading' : paymentData.status || 'completed' };

    try {
      if (file) {
        if (existingPayment.documentPath) await deleteObject(ref(storage, existingPayment.documentPath)).catch(e => console.warn("Old file not found", e));
        const { url, path } = await uploadDocument(file, existingPayment.id);
        updatedData.documentUrl = url;
        updatedData.documentPath = path;
      } else if (existingPayment.documentPath && existingPayment.documentUrl) {
          await deleteObject(ref(storage, existingPayment.documentPath)).catch(e => console.warn("Old file not found", e));
          updatedData.documentUrl = undefined;
          updatedData.documentPath = undefined;
      }
      const finalDataToUpdate = { ...updatedData, date: Timestamp.fromDate(paymentData.date) };
      await updateDoc(paymentDocRef, cleanDataForFirebase(finalDataToUpdate));
      const updatedLocalPayment = { ...existingPayment, ...finalDataToUpdate, date: paymentData.date };
      setSupplierPayments(prev => prev.map(p => p.id === existingPayment.id ? updatedLocalPayment : p).sort((a,b) => b.date.getTime() - a.date.getTime()));
    } catch(error) {
       console.error("Error in updateSupplierPayment: ", error);
       throw error;
    }
  };
  
  const deleteSupplierPayment = async (payment: SupplierPayment) => {
    if (!currentUser) return;
    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'supplierPayments', payment.id));
        if (payment.documentPath) await deleteObject(ref(storage, payment.documentPath)).catch(e => console.warn("File to delete not found", e));
        setSupplierPayments(prev => prev.filter(p => p.id !== payment.id));
        toast({ title: "تم الحذف", description: "تم حذف الدفعة ومستندها المرفق بنجاح." });
    } catch (error) {
        console.error("Error deleting supplier payment: ", error);
        toast({ title: "خطأ", description: "لم نتمكن من حذف الدفعة.", variant: "destructive" });
    }
  };

const addCustomerPayment = async (payment: Omit<CustomerPayment, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    const paymentWithTimestamp = { ...payment, date: Timestamp.fromDate(payment.date) };
    const docData = cleanDataForFirebase(paymentWithTimestamp);
    
    const paymentDocRef = await addDoc(collection(db, 'users', currentUser.uid, 'customerPayments'), docData);
    const newPayment = { ...payment, id: paymentDocRef.id };
    
    setCustomerPayments(prev => [newPayment, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // This part is for applying payment to sales, which is handled in addCustomerSale
    // For now, adding a payment just adds a payment record.
    // The logic in addCustomerSale will consume credits.
    const batch = writeBatch(db);

    const unpaidSales = customerSales
      .filter(s => s.customerName === payment.customerName && (s.status === 'معلق' || s.status === 'مدفوع جزئياً'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let remainingAmount = payment.amount;

    for (const sale of unpaidSales) {
      if (remainingAmount <= 0) break;
      const dueAmount = sale.amount - sale.paidAmount;
      const amountToPayOnThisInvoice = Math.min(remainingAmount, dueAmount);

      if (amountToPayOnThisInvoice > 0) {
        const saleDocRef = doc(db, 'users', currentUser.uid, 'customerSales', sale.id);
        const newPaidAmount = sale.paidAmount + amountToPayOnThisInvoice;
        batch.update(saleDocRef, {
          paidAmount: newPaidAmount,
          status: newPaidAmount >= sale.amount ? 'مدفوع' : 'مدفوع جزئياً',
          paymentDate: Timestamp.fromDate(payment.date)
        });
        remainingAmount -= amountToPayOnThisInvoice;
      }
    }
    
    if (remainingAmount > 0) {
      const creditSale: Omit<CustomerSale, 'id'> = {
        customerName: payment.customerName,
        date: payment.date,
        amount: remainingAmount,
        paidAmount: remainingAmount,
        status: 'رصيد دائن',
        invoiceNumber: `CREDIT-${Date.now()}`,
        supplierName: payment.supplierName, 
        description: `رصيد دائن من دفعة بتاريخ ${format(payment.date, 'yyyy-MM-dd')}`,
      };
      const creditDocRef = doc(collection(db, 'users', currentUser.uid, 'customerSales'));
      batch.set(creditDocRef, { ...creditSale, date: Timestamp.fromDate(creditSale.date) });
    }
    
    await batch.commit();

    const salesSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'customerSales'));
    const fetchedSales = salesSnapshot.docs.map(doc => {
        const data = doc.data();
        const saleDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        const paymentDate = data.paymentDate ? (data.paymentDate instanceof Timestamp ? data.paymentDate.toDate() : new Date(data.paymentDate)) : undefined;
        return { ...data, id: doc.id, date: saleDate, paymentDate } as CustomerSale;
    });
    setCustomerSales(fetchedSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
};


  const updateCustomerPayment = async (updatedPayment: CustomerPayment) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const docData = cleanDataForFirebase({ ...updatedPayment, date: Timestamp.fromDate(updatedPayment.date), confirmedDate: updatedPayment.confirmedDate ? Timestamp.fromDate(updatedPayment.confirmedDate) : undefined });
      await updateDoc(doc(db, 'users', currentUser.uid, 'customerPayments', updatedPayment.id), docData);
      setCustomerPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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
      await deleteDoc(doc(db, 'users', currentUser.uid, 'customerPayments', paymentId));
      setCustomerPayments(prev => prev.filter(p => p.id !== paymentId));
      toast({ title: "تم الحذف", description: "تم حذف مدفوعة العميل بنجاح. يرجى مراجعة أرصدة الفواتير يدويًا." });
    } catch (error) {
      console.error("Error deleting customer payment: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف مدفوعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  const confirmCustomerPayment = async (paymentId: string, confirmedBy: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const updatedData = { receivedStatus: 'تم الاستلام' as const, confirmedDate: Timestamp.now(), confirmedBy };
      await updateDoc(doc(db, 'users', currentUser.uid, 'customerPayments', paymentId), updatedData);
      setCustomerPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...updatedData, confirmedDate: new Date() } : p));
      toast({ title: "تم التأكيد", description: "تم تأكيد استلام مدفوعة العميل بنجاح." });
    } catch (error) {
      console.error("Error confirming customer payment: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من تأكيد استلام المدفوعة.", variant: "destructive" });
      throw error;
    }
  };

  const addCustomerSale = async (saleData: Omit<CustomerSale, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    let amountToPay = saleData.amount;
    const batch = writeBatch(db);

    const creditSales = customerSales
        .filter(s => s.customerName === saleData.customerName && s.status === 'رصيد دائن')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const credit of creditSales) {
        if (amountToPay <= 0) break;
        const creditAmount = credit.amount - credit.paidAmount;
        const amountToApply = Math.min(amountToPay, creditAmount);
        
        credit.paidAmount += amountToApply;
        amountToPay -= amountToApply;
        
        const creditDocRef = doc(db, 'users', currentUser.uid, 'customerSales', credit.id);
        if (credit.paidAmount >= credit.amount) {
            batch.delete(creditDocRef);
        } else {
            batch.update(creditDocRef, { paidAmount: credit.paidAmount });
        }
    }
    
    const newSale: Omit<CustomerSale, 'id'> = {
        ...saleData,
        paidAmount: saleData.amount - amountToPay,
        status: amountToPay <= 0 ? 'مدفوع' : (amountToPay < saleData.amount ? 'مدفوع جزئياً' : 'معلق'),
    };
    
    const saleDocRef = doc(collection(db, 'users', currentUser.uid, 'customerSales'));
    batch.set(saleDocRef, { ...newSale, date: Timestamp.fromDate(newSale.date) });
    
    const newSaleWithId = { ...newSale, id: saleDocRef.id };

    const paymentDataFromSale: Omit<CustomerPayment, 'id'> = {
      ...createCustomerPaymentDataFromTransaction(newSaleWithId as any),
      transactionType: 'sale',
    };
    const paymentDocRef = doc(collection(db, 'users', currentUser.uid, 'customerPayments'));
    batch.set(paymentDocRef, { ...paymentDataFromSale, date: Timestamp.fromDate(paymentDataFromSale.date) });

    await batch.commit();

    setCustomerSales(prev => [...prev, newSaleWithId].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setCustomerPayments(prev => [...prev, { ...paymentDataFromSale, id: paymentDocRef.id }].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };


  const updateCustomerSale = async (updatedSale: CustomerSale) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const { id, ...dataToUpdate } = updatedSale;
      const finalStatus = dataToUpdate.paidAmount >= dataToUpdate.amount ? 'مدفوع' : dataToUpdate.paidAmount > 0 ? 'مدفوع جزئياً' : 'معلق';
      
      const docData = cleanDataForFirebase({ 
          ...dataToUpdate, 
          status: finalStatus,
          date: Timestamp.fromDate(updatedSale.date),
          paymentDate: updatedSale.paymentDate ? Timestamp.fromDate(updatedSale.paymentDate) : undefined,
      });

      await updateDoc(doc(db, 'users', currentUser.uid, 'customerSales', id), docData);
      
      const newUpdatedSale = { ...updatedSale, status: finalStatus };
      setCustomerSales(prev => prev.map(s => s.id === id ? newUpdatedSale : s).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
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
      await deleteDoc(doc(db, 'users', currentUser.uid, 'customerSales', saleId));
      setCustomerSales(prev => prev.filter(s => s.id !== saleId));
      toast({ title: "تم الحذف", description: "تم حذف مبيعة العميل بنجاح." });
    } catch (error) {
      console.error("Error deleting customer sale: ", error);
      toast({ title: "خطأ", description: "لم نتمكن من حذف مبيعة العميل.", variant: "destructive" });
      throw error;
    }
  };

  const createCustomerPaymentDataFromTransaction = (transaction: Transaction | CustomerSale): Omit<CustomerPayment, 'id'> => {
    return {
      date: new Date(),
      customerName: transaction.customerName || '',
      supplierName: transaction.supplierName,
      amount: 'totalSellingPrice' in transaction ? transaction.totalSellingPrice || 0 : transaction.amount,
      paymentMethod: 'نقدي',
      receivedStatus: 'في الانتظار',
      operationNumber: transaction.operationNumber,
      governorate: 'governorate' in transaction ? transaction.governorate : undefined,
      city: 'city' in transaction ? transaction.city : undefined,
      description: transaction.description,
      quantity: 'quantity' in transaction ? transaction.quantity : undefined,
      sellingPrice: 'sellingPrice' in transaction ? transaction.sellingPrice : undefined,
      notes: `مدفوعة من عملية ${transaction.operationNumber || transaction.id}`,
    };
  };

  const createCustomerPaymentFromTransaction = async (transaction: Transaction): Promise<void> => {
    const paymentData = createCustomerPaymentDataFromTransaction(transaction);
    await addCustomerPayment(paymentData);
  };

  const getTransactionByOperationNumber = (operationNumber: string): Transaction | undefined => {
    return transactions.find(t => t.operationNumber === operationNumber);
  };

  const getInventoryBalance = (category: string, variety: string, customerName: string, supplierName: string, governorate: string, city: string): InventoryBalance | null => {
    const relatedTransactions = transactions.filter(t => 
      (t.category === category || (!t.category && !category)) &&
      (t.variety === variety || (!t.variety && !variety)) &&
      (t.customerName === customerName || (!t.customerName && !customerName)) &&
      t.supplierName === supplierName &&
      (t.governorate === governorate || (!t.governorate && !governorate)) &&
      (t.city === city || (!t.city && !city))
    );
    if (relatedTransactions.length === 0) return null;
    const totalQuantity = relatedTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalAmount = relatedTransactions.reduce((sum, t) => sum + (t.totalPurchasePrice || 0), 0);
    const actualQuantityDeducted = relatedTransactions.reduce((sum, t) => sum + (t.actualQuantityDeducted || 0), 0);
    const remainingQuantity = totalQuantity - actualQuantityDeducted;
    const remainingAmount = relatedTransactions.reduce((sum, t) => sum + (t.remainingAmount || 0), 0);
    const lastTransaction = relatedTransactions.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    return {
      id: `${category}-${variety}-${customerName}-${supplierName}-${governorate}-${city}`, category, variety, customerName, supplierName, governorate, city,
      totalQuantity, totalAmount, actualQuantityDeducted, remainingQuantity, remainingAmount,
      lastTransactionDate: lastTransaction.date, lastTransactionNumber: lastTransaction.transactionNumber || lastTransaction.operationNumber
    };
  };

  return (
    <TransactionsContext.Provider value={{ 
      transactions, addTransaction, updateTransaction, deleteTransaction, 
      expenses, addExpense, updateExpense, deleteExpense,
      suppliers, addSupplier, updateSupplier, deleteSupplier,
      customers, addCustomer, updateCustomer, deleteCustomer,
      balanceTransfers, addBalanceTransfer, updateBalanceTransfer, deleteBalanceTransfer,
      supplierPayments, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment,
      customerPayments, addCustomerPayment, updateCustomerPayment, deleteCustomerPayment, confirmCustomerPayment,
      customerSales, addCustomerSale, updateCustomerSale, deleteCustomerSale,
      createCustomerPaymentDataFromTransaction, createCustomerPaymentFromTransaction,
      getTransactionByOperationNumber, getCustomerBalance, getInventoryBalance,
      supplierNames, customerNames, loading 
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
