import { redirect } from 'next/navigation';

export default function Page() {
  // تم إلغاء تفاصيل تقرير مبيعات العملاء — إعادة التوجيه إلى سجل العملاء
  redirect('/customers-log');
}
