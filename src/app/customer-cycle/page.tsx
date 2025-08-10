import { redirect } from 'next/navigation';

export default function Page() {
  // تم إلغاء تقرير العملاء — إعادة التوجيه إلى سجل العملاء
  redirect('/customers-log');
}
