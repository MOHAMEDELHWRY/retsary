"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addMonths, addDays } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar as CalendarIcon, Plus, Trash2, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Installment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  status: 'مستحق' | 'مدفوع' | 'متأخر';
  paymentId?: string;
}

interface InstallmentPlan {
  installments: Installment[];
  createdDate: Date;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

interface InstallmentPlannerProps {
  totalAmount: number;
  onPlanChange: (plan: InstallmentPlan | null) => void;
  existingPlan?: InstallmentPlan;
}

export function InstallmentPlanner({ totalAmount, onPlanChange, existingPlan }: InstallmentPlannerProps) {
  const [numberOfInstallments, setNumberOfInstallments] = useState(existingPlan?.installments.length || 3);
  const [firstPaymentDate, setFirstPaymentDate] = useState<Date>(existingPlan?.installments[0]?.dueDate || new Date());
  const [intervalType, setIntervalType] = useState<'monthly' | 'custom'>('monthly');
  const [customAmounts, setCustomAmounts] = useState<number[]>(
    existingPlan?.installments.map(i => i.amount) || Array(numberOfInstallments).fill(Math.round(totalAmount / numberOfInstallments))
  );
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const generateInstallments = (): Installment[] => {
    const installments: Installment[] = [];
    let currentDate = new Date(firstPaymentDate);

    for (let i = 0; i < numberOfInstallments; i++) {
      const installment: Installment = {
        id: `installment-${i + 1}`,
        installmentNumber: i + 1,
        amount: customAmounts[i] || Math.round(totalAmount / numberOfInstallments),
        dueDate: new Date(currentDate),
        status: 'مستحق' as const,
      };

      // تحديد الحالة بناءً على التاريخ
      const today = new Date();
      if (installment.dueDate < today) {
        installment.status = 'متأخر';
      }

      installments.push(installment);

      // تحديد التاريخ التالي
      if (intervalType === 'monthly') {
        currentDate = addMonths(currentDate, 1);
      } else {
        currentDate = addDays(currentDate, 30); // افتراضي 30 يوم
      }
    }

    return installments;
  };

  const updateCustomAmount = (index: number, amount: number) => {
    const newAmounts = [...customAmounts];
    newAmounts[index] = amount;
    setCustomAmounts(newAmounts);
  };

  const calculateTotal = () => {
    return customAmounts.reduce((sum, amount) => sum + (amount || 0), 0);
  };

  const createPlan = () => {
    const installments = generateInstallments();
    const plan: InstallmentPlan = {
      installments,
      createdDate: new Date(),
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
    };
    onPlanChange(plan);
  };

  const clearPlan = () => {
    onPlanChange(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'مدفوع':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />مدفوع</Badge>;
      case 'متأخر':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />متأخر</Badge>;
      case 'مستحق':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />مستحق</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
          خطة الدفع بالتقسيط
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {!existingPlan ? (
          <>
            {/* إعدادات الخطة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numberOfInstallments" className="text-sm">عدد الأقساط</Label>
                <Input
                  id="numberOfInstallments"
                  type="number"
                  min="2"
                  max="12"
                  value={numberOfInstallments}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 2;
                    setNumberOfInstallments(count);
                    setCustomAmounts(Array(count).fill(Math.round(totalAmount / count)));
                  }}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">تاريخ أول قسط</Label>
                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal text-sm sm:text-base",
                        !firstPaymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {firstPaymentDate ? format(firstPaymentDate, "PPP", { locale: ar }) : "اختر التاريخ"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={firstPaymentDate}
                      onSelect={(date) => {
                        setFirstPaymentDate(date || new Date());
                        setIsDatePopoverOpen(false);
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="w-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* تخصيص المبالغ */}
            <div className="space-y-4">
              <Label className="text-sm sm:text-base font-semibold">تخصيص مبالغ الأقساط</Label>
              <div className="grid gap-3">
                {Array.from({ length: numberOfInstallments }, (_, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                    <Label className="min-w-[80px] text-sm">القسط {index + 1}:</Label>
                    <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                      <Input
                        type="number"
                        min="1"
                        value={customAmounts[index] || ''}
                        onChange={(e) => updateCustomAmount(index, parseFloat(e.target.value) || 0)}
                        className="flex-1 text-base"
                      />
                      <span className="text-sm text-muted-foreground min-w-[40px]">ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* عرض المجموع */}
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium text-sm sm:text-base">المجموع:</span>
                <span className={cn(
                  "font-bold text-base sm:text-lg",
                  calculateTotal() === totalAmount ? "text-green-600" : "text-red-600"
                )}>
                  {calculateTotal().toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              
              {calculateTotal() !== totalAmount && (
                <div className="text-xs sm:text-sm text-red-600 text-center p-2 bg-red-50 rounded-md">
                  تحذير: مجموع الأقساط ({calculateTotal().toLocaleString('ar-EG')} ج.م) لا يساوي المبلغ الإجمالي ({totalAmount.toLocaleString('ar-EG')} ج.م)
                </div>
              )}
            </div>

            {/* أزرار التحكم */}
            <div className="flex gap-3">
              <Button 
                onClick={createPlan}
                disabled={calculateTotal() !== totalAmount}
                className="flex-1 text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 mr-2" />
                إنشاء خطة الأقساط
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* عرض الخطة الموجودة */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground">المبلغ الإجمالي</div>
                  <div className="text-base sm:text-lg font-bold">{existingPlan.totalAmount.toLocaleString('ar-EG')} ج.م</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground">المدفوع</div>
                  <div className="text-base sm:text-lg font-bold text-green-600">{existingPlan.paidAmount.toLocaleString('ar-EG')} ج.م</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground">المتبقي</div>
                  <div className="text-base sm:text-lg font-bold text-orange-600">{existingPlan.remainingAmount.toLocaleString('ar-EG')} ج.م</div>
                </div>
              </div>

              {/* جدول الأقساط */}
              <div className="overflow-x-auto">
                <Table className="min-w-full text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center min-w-[60px]">القسط</TableHead>
                      <TableHead className="text-center min-w-[80px]">المبلغ</TableHead>
                      <TableHead className="text-center min-w-[100px]">تاريخ الاستحقاق</TableHead>
                      <TableHead className="text-center min-w-[80px]">الحالة</TableHead>
                      <TableHead className="text-center min-w-[100px]">تاريخ الدفع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existingPlan.installments.map((installment) => (
                      <TableRow key={installment.id}>
                        <TableCell className="text-center font-medium">{installment.installmentNumber}</TableCell>
                        <TableCell className="text-center font-bold">{installment.amount.toLocaleString('ar-EG')} ج.م</TableCell>
                        <TableCell className="text-center">{format(installment.dueDate, 'yyyy-MM-dd')}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(installment.status)}</TableCell>
                        <TableCell className="text-center">
                          {installment.paidDate ? format(installment.paidDate, 'yyyy-MM-dd') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button 
                onClick={clearPlan}
                variant="destructive"
                className="w-full text-sm sm:text-base"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                إلغاء خطة الأقساط
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
